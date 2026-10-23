import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { db, UPLOAD_DIR } from "./db.js";
import { CROPS, getCrop } from "./crops.js";
import { evaluateRules } from "./rules.js";
import { analyze } from "./analyzer.js";

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()) }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname) || ".jpg"}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

/* ---------- Helpers ---------- */
const optNum = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable());
const optStr = z.preprocess((v) => (v === "" || v == null ? null : String(v)), z.string().max(2000).nullable());

const photoUrl = (filename: string) => `/uploads/${filename}`;

function loadObservation(id: number) {
  const obs = db.prepare("SELECT * FROM observations WHERE id = ?").get(id) as any;
  if (!obs) return null;
  obs.photos = (db.prepare("SELECT * FROM observation_photos WHERE observation_id = ?").all(id) as any[])
    .map((p) => ({ ...p, url: photoUrl(p.filename) }));
  const a = db.prepare("SELECT * FROM analyses WHERE observation_id = ? ORDER BY id DESC LIMIT 1").get(id) as any;
  obs.analysis = a ? { ...a, result: a.result_json ? JSON.parse(a.result_json) : null, rule_flags: JSON.parse(a.rule_flags_json) } : null;
  if (obs.analysis) { delete obs.analysis.result_json; delete obs.analysis.rule_flags_json; }
  return obs;
}

/* ---------- Routes ---------- */
app.get("/api/health", (_req, res) => res.json({ ok: true, engine: process.env.ANTHROPIC_API_KEY ? "claude" : "mock" }));
app.get("/api/crops", (_req, res) => res.json(CROPS));

const PlantInput = z.object({
  name: z.string().min(1).max(100),
  crop: z.string().min(1),
  variety: optStr,
  planted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  growing_method: z.enum(["soil", "polybag", "hydroponic", "fertigation"]).default("soil"),
  location: optStr,
});

app.get("/api/plants", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM observations o WHERE o.plant_id = p.id) AS observation_count,
      (SELECT a.health_score FROM analyses a JOIN observations o ON o.id = a.observation_id
        WHERE o.plant_id = p.id AND a.health_score IS NOT NULL ORDER BY o.observed_at DESC, a.id DESC LIMIT 1) AS latest_score,
      (SELECT ph.filename FROM observation_photos ph JOIN observations o ON o.id = ph.observation_id
        WHERE o.plant_id = p.id ORDER BY o.observed_at DESC, ph.id LIMIT 1) AS cover
    FROM plants p ORDER BY p.created_at DESC`).all() as any[];
  res.json(rows.map((r) => ({ ...r, cover: r.cover ? photoUrl(r.cover) : null })));
});

app.post("/api/plants", (req, res) => {
  const p = PlantInput.parse(req.body);
  const info = db.prepare(`INSERT INTO plants (name, crop, variety, planted_at, growing_method, location)
    VALUES (@name, @crop, @variety, @planted_at, @growing_method, @location)`).run(p);
  res.status(201).json(db.prepare("SELECT * FROM plants WHERE id = ?").get(info.lastInsertRowid));
});

app.get("/api/plants/:id", (req, res) => {
  const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(Number(req.params.id)) as any;
  if (!plant) return res.status(404).json({ error: "Plant not found" });
  const ids = db.prepare("SELECT id FROM observations WHERE plant_id = ? ORDER BY observed_at DESC, id DESC").all(plant.id) as { id: number }[];
  res.json({ ...plant, crop_profile: getCrop(plant.crop), observations: ids.map((r) => loadObservation(r.id)) });
});

app.delete("/api/plants/:id", (req, res) => {
  db.prepare("DELETE FROM plants WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

const ObservationInput = z.object({
  observed_at: z.string().min(10),
  ph: optNum, ec: optNum, temp_c: optNum, humidity: optNum, soil_moisture: optNum, light_hours: optNum,
  watering: optStr, fertilizer: optStr, notes: optStr,
});

app.post("/api/plants/:id/observations", upload.array("photos", 5), (req, res) => {
  const plantId = Number(req.params.id);
  if (!db.prepare("SELECT 1 FROM plants WHERE id = ?").get(plantId)) return res.status(404).json({ error: "Plant not found" });
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) return res.status(400).json({ error: "At least one photo (jpeg/png/webp) is required" });

  const o = ObservationInput.parse(req.body);
  const angles: string[] = [].concat(req.body.angles ?? []);
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO observations
      (plant_id, observed_at, ph, ec, temp_c, humidity, soil_moisture, light_hours, watering, fertilizer, notes)
      VALUES (@plant_id, @observed_at, @ph, @ec, @temp_c, @humidity, @soil_moisture, @light_hours, @watering, @fertilizer, @notes)`)
      .run({ ...o, plant_id: plantId });
    const ins = db.prepare("INSERT INTO observation_photos (observation_id, filename, mime, angle) VALUES (?, ?, ?, ?)");
    files.forEach((f, n) => ins.run(info.lastInsertRowid, f.filename, f.mimetype, angles[n] || "whole"));
    return Number(info.lastInsertRowid);
  })();
  res.status(201).json(loadObservation(id));
});

app.get("/api/observations/:id", (req, res) => {
  const obs = loadObservation(Number(req.params.id));
  obs ? res.json(obs) : res.status(404).json({ error: "Observation not found" });
});

app.post("/api/observations/:id/analyze", wrap(async (req, res) => {
  const obs = loadObservation(Number(req.params.id));
  if (!obs) return res.status(404).json({ error: "Observation not found" });
  const plant = db.prepare("SELECT * FROM plants WHERE id = ?").get(obs.plant_id) as any;
  const crop = getCrop(plant.crop);
  const ruleFlags = evaluateRules(crop, obs, plant.growing_method);

  const prevRow = db.prepare(`SELECT id FROM observations WHERE plant_id = ? AND (observed_at < ? OR (observed_at = ? AND id < ?))
    ORDER BY observed_at DESC, id DESC LIMIT 1`).get(plant.id, obs.observed_at, obs.observed_at, obs.id) as { id: number } | undefined;
  const prev = prevRow ? loadObservation(prevRow.id) : null;
  const { photos, analysis, ...obsFields } = obs;

  const insert = db.prepare(`INSERT INTO analyses (observation_id, engine, health_score, result_json, rule_flags_json, error)
    VALUES (?, ?, ?, ?, ?, ?)`);
  try {
    const { engine, result } = await analyze({
      crop, plant, observation: obsFields, photos, ruleFlags,
      previous: prev ? {
        observation: { observed_at: prev.observed_at, ph: prev.ph, ec: prev.ec, temp_c: prev.temp_c, humidity: prev.humidity, notes: prev.notes },
        summary: prev.analysis?.result?.summary, health_score: prev.analysis?.health_score,
      } : null,
    });
    insert.run(obs.id, engine, result.health_score, JSON.stringify(result), JSON.stringify(ruleFlags), null);
  } catch (e: any) {
    console.error("analysis failed", e);
    insert.run(obs.id, "error", null, null, JSON.stringify(ruleFlags), String(e?.message ?? e));
  }
  res.json(loadObservation(obs.id));
}));

app.patch("/api/analyses/:id/feedback", (req, res) => {
  const f = z.object({ helpful: z.boolean(), note: optStr.optional() }).parse(req.body);
  db.prepare("UPDATE analyses SET feedback_helpful = ?, feedback_note = ? WHERE id = ?").run(f.helpful ? 1 : 0, f.note ?? null, Number(req.params.id));
  res.status(204).end();
});

/* ---------- Errors ---------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: err.issues });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`AgriLens API on :${port} (engine: ${process.env.ANTHROPIC_API_KEY ? "claude" : "mock"})`));
