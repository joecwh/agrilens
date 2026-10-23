import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { CropProfile } from "../types";
import { today } from "../util";

export default function NewPlant() {
  const nav = useNavigate();
  const [crops, setCrops] = useState<CropProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.crops().then(setCrops); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setError(null);
    try {
      const p = await api.createPlant(f as any);
      nav(`/plants/${p.id}/observe`, { replace: true });
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="form">
      <h1>New plant</h1>
      <label>Name / bed<input name="name" required placeholder="e.g. Bed A – chilli row 3" /></label>
      <label>Crop
        <select name="crop" required defaultValue="">
          <option value="" disabled>Select…</option>
          {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Variety <span className="muted">(optional)</span><input name="variety" placeholder="e.g. Kulai F1" /></label>
      <div className="grid2">
        <label>Planted on<input type="date" name="planted_at" required defaultValue={today()} max={today()} /></label>
        <label>Method
          <select name="growing_method" defaultValue="soil">
            <option value="soil">Soil</option>
            <option value="polybag">Polybag</option>
            <option value="fertigation">Fertigation</option>
            <option value="hydroponic">Hydroponic</option>
          </select>
        </label>
      </div>
      <label>Location <span className="muted">(optional)</span><input name="location" placeholder="e.g. Greenhouse 1" /></label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-block" disabled={busy}>{busy ? "Saving…" : "Save & add first log"}</button>
    </form>
  );
}
