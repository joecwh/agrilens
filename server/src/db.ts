import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "agrilens.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS plants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  crop TEXT NOT NULL,
  variety TEXT,
  planted_at TEXT NOT NULL,
  growing_method TEXT NOT NULL DEFAULT 'soil',  -- soil | polybag | hydroponic | fertigation
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  ph REAL,
  ec REAL,               -- mS/cm
  temp_c REAL,
  humidity REAL,         -- %
  soil_moisture REAL,    -- %
  light_hours REAL,
  watering TEXT,
  fertilizer TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS observation_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT 'whole'   -- whole | leaf | underside | root | fruit | other
);

CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  engine TEXT NOT NULL,          -- claude:<model> | mock
  health_score INTEGER,
  result_json TEXT,
  rule_flags_json TEXT NOT NULL,
  error TEXT,
  feedback_helpful INTEGER,      -- 1 / 0 / NULL
  feedback_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
