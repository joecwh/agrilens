export type Range = { min: number; max: number };

export interface CropProfile {
  id: string; name: string;
  ph: Range; ec?: Range; tempC: Range; humidity?: Range; soilMoisture?: Range; daysToHarvest?: Range;
  notes?: string;
}

export interface Plant {
  id: number; name: string; crop: string; variety: string | null; planted_at: string;
  growing_method: "soil" | "polybag" | "hydroponic" | "fertigation"; location: string | null; created_at: string;
  observation_count?: number; latest_score?: number | null; cover?: string | null;
}

export interface RuleFlag {
  field: string; label: string; value: number; range: Range; severity: "warn" | "critical"; message: string;
}

export interface Assessment {
  summary: string;
  overall_health: "healthy" | "mild" | "moderate" | "severe";
  health_score: number;
  confidence: number;
  growth_stage: string;
  image_quality: { usable: boolean; issues: string[] };
  visual_findings: string[];
  issues: { name: string; category: string; likelihood: "low" | "medium" | "high"; evidence: string }[];
  recommendations: { priority: "high" | "medium" | "low"; action: string; reason: string; timeframe: string }[];
  trend_vs_previous: string | null;
  follow_up: { recheck_in_days: number; photo_tips: string[] };
}

export interface Analysis {
  id: number; engine: string; health_score: number | null; error: string | null;
  feedback_helpful: number | null; created_at: string;
  result: Assessment | null; rule_flags: RuleFlag[];
}

export interface Photo { id: number; filename: string; mime: string; angle: string; url: string }

export interface Observation {
  id: number; plant_id: number; observed_at: string;
  ph: number | null; ec: number | null; temp_c: number | null; humidity: number | null;
  soil_moisture: number | null; light_hours: number | null;
  watering: string | null; fertilizer: string | null; notes: string | null;
  photos: Photo[]; analysis: Analysis | null;
}

export interface PlantDetail extends Plant { crop_profile: CropProfile; observations: Observation[] }
