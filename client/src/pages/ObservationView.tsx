import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, assetUrl } from "../api";
import type { Observation } from "../types";
import { fmtDate, ScoreBadge } from "../util";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export default function ObservationView() {
  const { id } = useParams();
  const [obs, setObs] = useState<Observation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<boolean | null>(null);

  useEffect(() => {
    api.observation(Number(id)).then((o) => {
      setObs(o);
      if (o.analysis?.feedback_helpful != null) setVoted(o.analysis.feedback_helpful === 1);
    }).catch((e) => setError(e.message));
  }, [id]);

  async function reanalyze() {
    setBusy(true); setError(null);
    try { setObs(await api.analyze(Number(id))); setVoted(null); } catch (e: any) { setError(e.message); }
    setBusy(false);
  }
  async function vote(helpful: boolean) {
    if (!obs?.analysis) return;
    setVoted(helpful);
    await api.feedback(obs.analysis.id, helpful).catch(() => setVoted(null));
  }

  if (error && !obs) return <p className="error">{error}</p>;
  if (!obs) return <p className="muted">Loading…</p>;

  const a = obs.analysis;
  const r = a?.result;
  const readings = [
    ["pH", obs.ph], ["EC", obs.ec], ["Temp °C", obs.temp_c], ["RH %", obs.humidity],
    ["Soil %", obs.soil_moisture], ["Light h", obs.light_hours],
  ].filter(([, v]) => v != null);

  return (
    <>
      <Link to={`/plants/${obs.plant_id}`} className="link">← Plant</Link>
      <h1>{fmtDate(obs.observed_at)}</h1>

      <div className="gallery">
        {obs.photos.map((p) => (
          <a key={p.id} href={assetUrl(p.url)} target="_blank" rel="noreferrer">
            <img src={assetUrl(p.url)} alt={p.angle} /><span>{p.angle}</span>
          </a>
        ))}
      </div>

      {readings.length > 0 && (
        <div className="targets">{readings.map(([k, v]) => <span key={k as string}>{k} <b>{v}</b></span>)}</div>
      )}

      {!a && <button className="btn btn-block" onClick={reanalyze} disabled={busy}>{busy ? "Analysing…" : "Analyse"}</button>}

      {a?.error && (
        <div className="card warn">
          <p><b>Analysis failed:</b> {a.error}</p>
          <button className="btn" onClick={reanalyze} disabled={busy}>{busy ? "Retrying…" : "Retry"}</button>
        </div>
      )}

      {r && (
        <>
          <section className="card verdict">
            <ScoreBadge score={r.health_score} size={72} />
            <div>
              <div className={`pill pill-${r.overall_health}`}>{r.overall_health}</div>
              <p>{r.summary}</p>
              <p className="muted small">
                Confidence {Math.round(r.confidence * 100)}% · stage: {r.growth_stage} · {a!.engine === "mock" ? "mock engine" : "AI"}
              </p>
            </div>
          </section>

          {!r.image_quality.usable && (
            <div className="card warn"><b>Photo quality:</b> {r.image_quality.issues.join("; ")}. Retake for a reliable result.</div>
          )}

          {a!.rule_flags.length > 0 && (
            <section>
              <h2>Out-of-range readings</h2>
              <ul className="list">
                {a!.rule_flags.map((f) => (
                  <li key={f.field} className={`sev-${f.severity}`}>{f.message}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>What to do</h2>
            <ol className="recs">
              {[...r.recommendations].sort((x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority]).map((rec, i) => (
                <li key={i} className={`prio-${rec.priority}`}>
                  <div className="row-between"><b>{rec.action}</b><span className="tag">{rec.timeframe}</span></div>
                  <p className="muted small">{rec.reason}</p>
                </li>
              ))}
            </ol>
          </section>

          {r.issues.length > 0 && (
            <section>
              <h2>Likely issues</h2>
              <ul className="list">
                {r.issues.map((iss, i) => (
                  <li key={i}>
                    <b>{iss.name}</b> <span className="tag">{iss.category}</span> <span className={`tag lk-${iss.likelihood}`}>{iss.likelihood}</span>
                    <p className="muted small">{iss.evidence}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.visual_findings.length > 0 && (
            <section>
              <h2>Seen in photos</h2>
              <ul className="list plain">{r.visual_findings.map((v, i) => <li key={i}>{v}</li>)}</ul>
            </section>
          )}

          {r.trend_vs_previous && (
            <section><h2>Since last log</h2><p>{r.trend_vs_previous}</p></section>
          )}

          <section className="card">
            <b>Re-check in {r.follow_up.recheck_in_days} day{r.follow_up.recheck_in_days === 1 ? "" : "s"}</b>
            {r.follow_up.photo_tips.length > 0 && <ul className="list plain small">{r.follow_up.photo_tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </section>

          <section className="feedback">
            <span>Was this helpful?</span>
            <button className={voted === true ? "chip on" : "chip"} onClick={() => vote(true)}>👍</button>
            <button className={voted === false ? "chip on" : "chip"} onClick={() => vote(false)}>👎</button>
            <button className="link" onClick={reanalyze} disabled={busy}>{busy ? "Analysing…" : "Re-analyse"}</button>
          </section>
          <p className="muted small">AI guidance can be wrong. For serious or spreading symptoms, confirm with an agronomist or DOA extension officer.</p>
        </>
      )}
    </>
  );
}
