import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, assetUrl } from "../api";
import type { Plant } from "../types";
import { daysSince, ScoreBadge } from "../util";

export default function PlantList() {
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.plants().then(setPlants).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="error">Can't reach the API: {error}</p>;
  if (!plants) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="row-between">
        <h1>My plants</h1>
        <Link to="/plants/new" className="btn">+ Plant</Link>
      </div>
      {plants.length === 0 ? (
        <div className="empty">
          <p>No plants yet.</p>
          <p className="muted">Add a plant or bed, then log photos and readings to get an assessment.</p>
        </div>
      ) : (
        <ul className="cards">
          {plants.map((p) => (
            <li key={p.id}>
              <Link to={`/plants/${p.id}`} className="plant-card">
                <div className="thumb">{p.cover ? <img src={assetUrl(p.cover)} alt="" /> : <span>🌱</span>}</div>
                <div className="grow">
                  <strong>{p.name}</strong>
                  <div className="muted small">
                    {p.crop} · {p.growing_method} · day {daysSince(p.planted_at)} · {p.observation_count} log{p.observation_count === 1 ? "" : "s"}
                  </div>
                </div>
                <ScoreBadge score={p.latest_score} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
