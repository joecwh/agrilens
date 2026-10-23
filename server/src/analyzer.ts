import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CropProfile } from "./crops.js";
import { RuleFlag } from "./rules.js";
import { UPLOAD_DIR } from "./db.js";

/* ---------- Output contract (shared with client) ---------- */
export const AssessmentSchema = z.object({
  summary: z.string(),
  overall_health: z.enum(["healthy", "mild", "moderate", "severe"]),
  health_score: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  growth_stage: z.string(),
  image_quality: z.object({ usable: z.boolean(), issues: z.array(z.string()) }),
  visual_findings: z.array(z.string()),
  issues: z.array(z.object({
    name: z.string(),
    category: z.enum(["nutrient", "pest", "disease", "water", "environment", "other"]),
    likelihood: z.enum(["low", "medium", "high"]),
    evidence: z.string(),
  })),
  recommendations: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]),
    action: z.string(),
    reason: z.string(),
    timeframe: z.string(),
  })),
  trend_vs_previous: z.string().nullable(),
  follow_up: z.object({ recheck_in_days: z.number().int(), photo_tips: z.array(z.string()) }),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

const TOOL: Anthropic.Tool = {
  name: "report_plant_assessment",
  description: "Report the structured plant health assessment.",
  input_schema: {
    type: "object",
    required: ["summary", "overall_health", "health_score", "confidence", "growth_stage", "image_quality",
      "visual_findings", "issues", "recommendations", "trend_vs_previous", "follow_up"],
    properties: {
      summary: { type: "string", description: "2-3 sentence plain-language verdict for the grower." },
      overall_health: { type: "string", enum: ["healthy", "mild", "moderate", "severe"] },
      health_score: { type: "integer", minimum: 0, maximum: 100 },
      confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence in the diagnosis given photo quality and data." },
      growth_stage: { type: "string", description: "e.g. seedling, vegetative, flowering, fruiting" },
      image_quality: {
        type: "object", required: ["usable", "issues"],
        properties: { usable: { type: "boolean" }, issues: { type: "array", items: { type: "string" } } },
      },
      visual_findings: { type: "array", items: { type: "string" }, description: "What is actually visible in the photos." },
      issues: {
        type: "array",
        items: {
          type: "object", required: ["name", "category", "likelihood", "evidence"],
          properties: {
            name: { type: "string" },
            category: { type: "string", enum: ["nutrient", "pest", "disease", "water", "environment", "other"] },
            likelihood: { type: "string", enum: ["low", "medium", "high"] },
            evidence: { type: "string", description: "Which visual cue or reading supports this." },
          },
        },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object", required: ["priority", "action", "reason", "timeframe"],
          properties: {
            priority: { type: "string", enum: ["high", "medium", "low"] },
            action: { type: "string", description: "Concrete, doable step with quantities where sensible." },
            reason: { type: "string" },
            timeframe: { type: "string", description: "e.g. today, within 3 days, ongoing" },
          },
        },
      },
      trend_vs_previous: { type: ["string", "null"], description: "Comparison with the previous observation, or null if none." },
      follow_up: {
        type: "object", required: ["recheck_in_days", "photo_tips"],
        properties: { recheck_in_days: { type: "integer" }, photo_tips: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

/* ---------- Input ---------- */
export interface AnalysisInput {
  crop: CropProfile;
  plant: { name: string; variety: string | null; growing_method: string; location: string | null; planted_at: string };
  observation: Record<string, unknown> & { observed_at: string };
  photos: { filename: string; mime: string; angle: string }[];
  ruleFlags: RuleFlag[];
  previous?: { observation: Record<string, unknown>; summary?: string; health_score?: number | null } | null;
}

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

function buildPrompt(i: AnalysisInput): string {
  const age = daysBetween(i.plant.planted_at, i.observation.observed_at);
  const o = i.observation;
  const reading = (k: string, unit = "") => (o[k] == null || o[k] === "" ? "not recorded" : `${o[k]}${unit}`);
  return `You are an experienced agronomist advising a grower in a tropical climate (Malaysia unless stated).
Assess the plant in the attached photo(s) together with the grower's records. Be honest about uncertainty:
if the photos are blurry, dark, or don't show the relevant part, say so, lower confidence, and ask for better photos.
Do not invent symptoms that are not visible. Prefer practical, low-cost actions. Give quantities where sensible.

PLANT
- Name: ${i.plant.name}; crop: ${i.crop.name}${i.plant.variety ? ` (${i.plant.variety})` : ""}
- Growing method: ${i.plant.growing_method}; location: ${i.plant.location ?? "n/a"}
- Planted: ${i.plant.planted_at} → age ${age} days at observation
- Typical days to harvest: ${i.crop.daysToHarvest ? `${i.crop.daysToHarvest.min}–${i.crop.daysToHarvest.max}` : "n/a"}

READINGS (${o.observed_at})
- pH: ${reading("ph")} (target ${i.crop.ph.min}–${i.crop.ph.max})
- EC: ${reading("ec", " mS/cm")}${i.crop.ec ? ` (target ${i.crop.ec.min}–${i.crop.ec.max})` : ""}
- Temperature: ${reading("temp_c", " °C")} (target ${i.crop.tempC.min}–${i.crop.tempC.max})
- Humidity: ${reading("humidity", " %")}
- Soil moisture: ${reading("soil_moisture", " %")}
- Light hours: ${reading("light_hours")}
- Watering: ${reading("watering")}
- Fertiliser: ${reading("fertilizer")}
- Grower notes: ${reading("notes")}

RULE-ENGINE FLAGS (deterministic range checks)
${i.ruleFlags.length ? i.ruleFlags.map((f) => `- [${f.severity}] ${f.message}`).join("\n") : "- none"}

PREVIOUS OBSERVATION
${i.previous ? JSON.stringify({ ...i.previous.observation, previous_summary: i.previous.summary, previous_health_score: i.previous.health_score }) : "none (first observation)"}

PHOTOS: ${i.photos.map((p, n) => `#${n + 1}=${p.angle}`).join(", ")}

Call report_plant_assessment with your assessment.`;
}

/* ---------- Engines ---------- */
export async function analyze(i: AnalysisInput): Promise<{ engine: string; result: Assessment }> {
  if (!process.env.ANTHROPIC_API_KEY) return { engine: "mock", result: mockAnalyze(i) };

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const client = new Anthropic();
  const images: Anthropic.ImageBlockParam[] = i.photos.slice(0, 5).map((p) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: p.mime as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      data: fs.readFileSync(path.join(UPLOAD_DIR, p.filename)).toString("base64"),
    },
  }));

  const msg = await client.messages.create({
    model,
    max_tokens: 2000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: [...images, { type: "text", text: buildPrompt(i) }] }],
  });

  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error("Model returned no assessment");
  return { engine: `claude:${model}`, result: AssessmentSchema.parse(block.input) };
}

/** Deterministic fallback so the app works end-to-end without an API key. No image understanding. */
function mockAnalyze(i: AnalysisInput): Assessment {
  const crit = i.ruleFlags.filter((f) => f.severity === "critical").length;
  const warn = i.ruleFlags.length - crit;
  const score = Math.max(20, 90 - crit * 25 - warn * 10);
  const health = score >= 80 ? "healthy" : score >= 60 ? "mild" : score >= 40 ? "moderate" : "severe";
  const fieldCategory = (f: string) => (f === "soil_moisture" ? "water" : f === "ph" || f === "ec" ? "nutrient" : "environment");

  return {
    summary: `MOCK ANALYSIS (no ANTHROPIC_API_KEY set) — photos were not inspected. ${
      i.ruleFlags.length ? `${i.ruleFlags.length} reading(s) are outside the ${i.crop.name} target range.` : "All recorded readings are within target range."}`,
    overall_health: health,
    health_score: score,
    confidence: 0.3,
    growth_stage: "unknown",
    image_quality: { usable: true, issues: ["Not evaluated in mock mode"] },
    visual_findings: [],
    issues: i.ruleFlags.map((f) => ({
      name: `${f.label} out of range`, category: fieldCategory(f.field),
      likelihood: f.severity === "critical" ? "high" : "medium", evidence: `Recorded ${f.value}, target ${f.range.min}–${f.range.max}`,
    })),
    recommendations: i.ruleFlags.length
      ? i.ruleFlags.map((f) => ({
          priority: f.severity === "critical" ? "high" : "medium",
          action: f.message.split(". ").slice(1).join(". "),
          reason: `${f.label} is ${f.value}`, timeframe: f.severity === "critical" ? "today" : "within 3 days",
        }))
      : [{ priority: "low", action: "Keep current routine and log readings weekly.", reason: "No out-of-range readings", timeframe: "ongoing" }],
    trend_vs_previous: i.previous ? "Trend analysis requires the AI engine." : null,
    follow_up: { recheck_in_days: crit ? 2 : 7, photo_tips: ["Shoot in daylight, no flash", "Include a whole-plant and a leaf close-up"] },
  };
}
