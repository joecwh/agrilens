export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

export const daysSince = (date: string, until = today()) =>
  Math.max(0, Math.round((new Date(until).getTime() - new Date(date).getTime()) / 86_400_000));

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "none";
  return score >= 80 ? "good" : score >= 60 ? "fair" : score >= 40 ? "poor" : "bad";
}

export function ScoreBadge({ score, size = 44 }: { score: number | null | undefined; size?: number }) {
  const tone = scoreTone(score);
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const pct = score == null ? 0 : score / 100;
  return (
    <svg className={`score score-${tone}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={score == null ? "Not analysed" : `Health score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="score-track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="score-arc"
        strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32}>
        {score ?? "–"}
      </text>
    </svg>
  );
}
