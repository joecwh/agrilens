/**
 * Crop profiles: starting-point ranges for the rules engine.
 * Values are common published ranges — tune them to your variety, stage and local conditions.
 * EC in mS/cm, temperature in °C, humidity in %.
 */
export type Range = { min: number; max: number };

export interface CropProfile {
  id: string;
  name: string;
  ph: Range;
  ec?: Range;              // mainly meaningful for hydroponic/fertigation
  tempC: Range;
  humidity?: Range;
  soilMoisture?: Range;
  daysToHarvest?: Range;
  notes?: string;
}

export const CROPS: CropProfile[] = [
  {
    id: "chilli", name: "Chilli",
    ph: { min: 5.8, max: 6.5 }, ec: { min: 1.8, max: 2.8 },
    tempC: { min: 20, max: 30 }, humidity: { min: 50, max: 80 },
    soilMoisture: { min: 40, max: 70 }, daysToHarvest: { min: 75, max: 100 },
  },
  {
    id: "tomato", name: "Tomato",
    ph: { min: 5.5, max: 6.5 }, ec: { min: 2.0, max: 4.0 },
    tempC: { min: 18, max: 29 }, humidity: { min: 50, max: 75 },
    soilMoisture: { min: 40, max: 70 }, daysToHarvest: { min: 60, max: 90 },
  },
  {
    id: "lettuce", name: "Lettuce",
    ph: { min: 5.5, max: 6.5 }, ec: { min: 0.8, max: 1.4 },
    tempC: { min: 15, max: 26 }, humidity: { min: 50, max: 70 },
    soilMoisture: { min: 50, max: 80 }, daysToHarvest: { min: 30, max: 50 },
    notes: "Bolts and tip-burns in sustained heat; shade + airflow matter in lowland tropics.",
  },
  {
    id: "rockmelon", name: "Rockmelon / Melon",
    ph: { min: 6.0, max: 6.8 }, ec: { min: 2.0, max: 3.0 },
    tempC: { min: 22, max: 32 }, humidity: { min: 50, max: 75 },
    daysToHarvest: { min: 70, max: 90 },
  },
  {
    id: "cucumber", name: "Cucumber",
    ph: { min: 5.5, max: 6.5 }, ec: { min: 1.7, max: 2.5 },
    tempC: { min: 20, max: 30 }, humidity: { min: 60, max: 80 },
    daysToHarvest: { min: 45, max: 60 },
  },
  {
    id: "generic", name: "Other / Generic",
    ph: { min: 5.5, max: 7.0 },
    tempC: { min: 18, max: 32 },
  },
];

export const getCrop = (id: string) => CROPS.find((c) => c.id === id) ?? CROPS[CROPS.length - 1];
