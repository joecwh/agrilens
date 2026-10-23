import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { BLUR_THRESHOLD, compressImage } from "../image";
import type { PlantDetail } from "../types";
import { daysSince, today } from "../util";

type Shot = { key: string; blob: Blob; preview: string; angle: string; blurry: boolean };
const ANGLES = ["whole", "leaf", "underside", "fruit", "root", "other"];
const MAX_PHOTOS = 5;

export default function NewObservation() {
  const { id } = useParams();
  const plantId = Number(id);
  const nav = useNavigate();
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.plant(plantId).then(setPlant).catch((e) => setError(e.message)); }, [plantId]);
  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.preview)), []); // eslint-disable-line

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - shots.length;
    const picked = Array.from(files).slice(0, room);
    const next: Shot[] = [];
    for (const f of picked) {
      try {
        const { blob, sharpness } = await compressImage(f);
        const angle = ANGLES[Math.min(shots.length + next.length, 2)]; // whole → leaf → underside by default
        next.push({ key: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob), angle, blurry: sharpness < BLUR_THRESHOLD });
      } catch { setError(`Couldn't read ${f.name}`); }
    }
    setShots((s) => [...s, ...next]);
  }

  const removeShot = (key: string) => setShots((s) => s.filter((x) => x.key !== key));
  const setAngle = (key: string, angle: string) => setShots((s) => s.map((x) => (x.key === key ? { ...x, angle } : x)));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shots.length) return setError("Add at least one photo.");
    setError(null);
    const form = new FormData(e.currentTarget);
    shots.forEach((s, n) => { form.append("photos", s.blob, `photo-${n}.jpg`); form.append("angles", s.angle); });
    try {
      setStage("uploading");
      const obs = await api.createObservation(plantId, form);
      setStage("analyzing");
      await api.analyze(obs.id);
      nav(`/observations/${obs.id}`, { replace: true });
    } catch (err: any) { setError(err.message); setStage("idle"); }
  }

  if (!plant) return <p className="muted">{error ?? "Loading…"}</p>;
  const cp = plant.crop_profile;
  const hint = (r?: { min: number; max: number }) => (r ? `target ${r.min}–${r.max}` : "");
  const busy = stage !== "idle";

  return (
    <form onSubmit={submit} className="form">
      <h1>New log</h1>
      <p className="muted">{plant.name} · {cp.name} · day {daysSince(plant.planted_at)}</p>

      <section>
        <h2>Photos <span className="muted small">({shots.length}/{MAX_PHOTOS})</span></h2>
        <p className="muted small">Best results: whole plant + leaf close-up + leaf underside, in daylight, no flash.</p>
        <div className="shots">
          {shots.map((s) => (
            <figure key={s.key} className={s.blurry ? "shot blurry" : "shot"}>
              <img src={s.preview} alt="" />
              {s.blurry && <span className="flag">Looks blurry</span>}
              <button type="button" className="x" onClick={() => removeShot(s.key)} aria-label="Remove photo">×</button>
              <select value={s.angle} onChange={(e) => setAngle(s.key, e.target.value)}>
                {ANGLES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </figure>
          ))}
        </div>
        {shots.length < MAX_PHOTOS && (
          <div className="grid2">
            <button type="button" className="btn" onClick={() => cameraRef.current?.click()}>📷 Take photo</button>
            <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()}>🖼 Upload</button>
          </div>
        )}
        {/* capture="environment" opens the rear camera on Android/iOS (browser + Capacitor webview) */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </section>

      <section>
        <h2>Readings <span className="muted small">(leave blank if not measured)</span></h2>
        <label>Date<input type="date" name="observed_at" required defaultValue={today()} max={today()} /></label>
        <div className="grid2">
          <label>pH <small className="muted">{hint(cp.ph)}</small><input name="ph" type="number" step="0.1" min="0" max="14" inputMode="decimal" /></label>
          <label>EC mS/cm <small className="muted">{plant.growing_method !== "soil" && hint(cp.ec)}</small><input name="ec" type="number" step="0.1" min="0" inputMode="decimal" /></label>
          <label>Temp °C <small className="muted">{hint(cp.tempC)}</small><input name="temp_c" type="number" step="0.5" inputMode="decimal" /></label>
          <label>Humidity % <small className="muted">{hint(cp.humidity)}</small><input name="humidity" type="number" min="0" max="100" inputMode="numeric" /></label>
          <label>Soil moisture %<input name="soil_moisture" type="number" min="0" max="100" inputMode="numeric" /></label>
          <label>Sun / light hrs<input name="light_hours" type="number" step="0.5" min="0" max="24" inputMode="decimal" /></label>
        </div>
        <label>Watering<input name="watering" placeholder="e.g. 2×/day drip, 500 ml each" /></label>
        <label>Fertiliser<input name="fertilizer" placeholder="e.g. AB mix, NPK 15-15-15 10g/plant weekly" /></label>
        <label>Notes / symptoms<textarea name="notes" rows={3} placeholder="e.g. lower leaves yellowing, curled new leaves, white specks under leaf" /></label>
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-block" disabled={busy}>
        {stage === "uploading" ? "Uploading…" : stage === "analyzing" ? "Analysing plant…" : "Save & analyse"}
      </button>
    </form>
  );
}
