import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, assetUrl } from "../api";
import type { PlantDetail } from "../types";
import { daysSince, fmtDate, ScoreBadge } from "../util";

function Trend({ points }: { points: { date: string; score: number }[] }) {
  if (points.length < 2) return null;
  const W = 320, H = 70, P = 6;
  const xs = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const ys = (s: number) => H - P - (s / 100) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p.score)}`).join(" ");
  return (
    <figure className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Health score over time">
        <path d={d} />
        {points.map((p, i) => <circle key={i} cx={xs(i)} cy={ys(p.score)} r="3" />)}
      </svg>
      <figcaption className="muted small">Health score · {fmtDate(points[0].date)} → {fmtDate(points[points.length - 1].date)}</figcaption>
    </figure>
  );
}

export default function PlantView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.plant(Number(id)).then(setPlant).catch((e) => setError(e.message)); }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!plant) return <p className="muted">Loading…</p>;

  const cp = plant.crop_profile;
  const points = plant.observations
    .filter((o) => o.analysis?.health_score != null)
    .map((o) => ({ date: o.observed_at, score: o.analysis!.health_score! }))
    .reverse();

  async function remove() {
    if (!confirm(`Delete ${plant!.name} and all its logs?`)) return;
    await api.deletePlant(plant!.id);
    nav("/", { replace: true });
  }

  return (
    <>
      <div className="row-between">
        <div>
          <h1>{plant.name}</h1>
          <p className="muted">
            {cp.name}{plant.variety ? ` · ${plant.variety}` : ""} · {plant.growing_method} · day {daysSince(plant.planted_at)}
            {cp.daysToHarvest && ` (harvest ~${cp.daysToHarvest.min}–${cp.daysToHarvest.max})`}
          </p>
        </div>
        <Link to={`/plants/${plant.id}/observe`} className="btn">+ Log</Link>
      </div>

      <div className="targets">
        <span>pH {cp.ph.min}–{cp.ph.max}</span>
        {cp.ec && plant.growing_method !== "soil" && <span>EC {cp.ec.min}–{cp.ec.max}</span>}
        <span>{cp.tempC.min}–{cp.tempC.max} °C</span>
        {cp.humidity && <span>RH {cp.humidity.min}–{cp.humidity.max}%</span>}
      </div>

      <Trend points={points} />

      <h2>History</h2>
      {plant.observations.length === 0 && <p className="muted">No logs yet.</p>}
      <ul className="cards">
        {plant.observations.map((o) => (
          <li key={o.id}>
            <Link to={`/observations/${o.id}`} className="plant-card">
              <div className="thumb">{o.photos[0] ? <img src={assetUrl(o.photos[0].url)} alt="" /> : <span>📋</span>}</div>
              <div className="grow">
                <strong>{fmtDate(o.observed_at)}</strong>
                <div className="muted small clamp">
                  {o.analysis?.result?.summary ?? (o.analysis?.error ? "Analysis failed — tap to retry" : "Not analysed")}
                </div>
              </div>
              <ScoreBadge score={o.analysis?.health_score} size={40} />
            </Link>
          </li>
        ))}
      </ul>

      <button className="link danger" onClick={remove}>Delete plant</button>
    </>
  );
}
