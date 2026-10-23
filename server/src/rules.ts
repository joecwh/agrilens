import { CropProfile, Range } from "./crops.js";

export type Severity = "ok" | "warn" | "critical";

export interface RuleFlag {
  field: string;
  label: string;
  value: number;
  range: Range;
  severity: Exclude<Severity, "ok">;
  message: string;
}

export interface Readings {
  ph?: number | null;
  ec?: number | null;
  temp_c?: number | null;
  humidity?: number | null;
  soil_moisture?: number | null;
}

/** How far outside the range counts as critical (fraction of range width, min absolute). */
function severity(value: number, r: Range): Severity {
  if (value >= r.min && value <= r.max) return "ok";
  const width = r.max - r.min || 1;
  const dist = value < r.min ? r.min - value : value - r.max;
  return dist > Math.max(width * 0.5, 0.01) ? "critical" : "warn";
}

const HINTS: Record<string, { low: string; high: string }> = {
  ph: {
    low: "Acidic root zone locks out Ca/Mg/P. Raise pH (pH-up / dolomite for soil) and re-test in 24h.",
    high: "Alkaline root zone locks out Fe/Mn (yellow new leaves). Lower pH (pH-down / acidic fertiliser) and re-test.",
  },
  ec: {
    low: "Nutrient solution too weak — expect pale growth. Increase A+B dosing gradually.",
    high: "Salt stress risk (leaf-edge burn, wilting). Dilute with fresh water / flush media.",
  },
  temp_c: {
    low: "Below optimal temperature — growth slows. Protect from cold/wind.",
    high: "Heat stress — add shade net, improve airflow, water early morning.",
  },
  humidity: {
    low: "Low humidity increases transpiration stress and mites.",
    high: "High humidity favours fungal disease. Improve ventilation and spacing.",
  },
  soil_moisture: {
    low: "Root zone too dry — increase irrigation frequency.",
    high: "Waterlogging risk — root rot, yellowing. Reduce watering / improve drainage.",
  },
};

export function evaluateRules(crop: CropProfile, r: Readings, method: string): RuleFlag[] {
  const checks: [keyof Readings, string, Range | undefined][] = [
    ["ph", "pH", crop.ph],
    // EC targets are for nutrient solution; skip for plain soil unless provided ranges apply
    ["ec", "EC (mS/cm)", method === "soil" ? undefined : crop.ec],
    ["temp_c", "Temperature (°C)", crop.tempC],
    ["humidity", "Humidity (%)", crop.humidity],
    ["soil_moisture", "Soil moisture (%)", crop.soilMoisture],
  ];

  const flags: RuleFlag[] = [];
  for (const [field, label, range] of checks) {
    const v = r[field];
    if (v == null || Number.isNaN(v) || !range) continue;
    const s = severity(v, range);
    if (s === "ok") continue;
    const dir = v < range.min ? "low" : "high";
    flags.push({
      field, label, value: v, range, severity: s,
      message: `${label} ${v} is ${dir} (target ${range.min}–${range.max}). ${HINTS[field][dir]}`,
    });
  }
  return flags;
}
