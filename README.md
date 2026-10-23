# AgriLens — plant photo + readings → AI assessment

Cross-platform MVP: one React codebase runs as a **web/PWA app** and as **Android/iOS apps** via Capacitor, backed by a Node/Express API.

```
client/   React 19 + Vite + TypeScript + Capacitor (web, Android, iOS)
server/   Express + TypeScript + SQLite + Claude vision analysis
```

## Run it

```bash
# API
cd server
cp .env.example .env          # add ANTHROPIC_API_KEY for real AI; leave blank for mock mode
npm install
npm run dev                   # http://localhost:4000

# Client (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173  (also on your LAN IP for phone testing)
```

Without an API key the server runs a **mock engine**: rule checks only, photos not inspected. The header badge shows `MOCK` vs `AI`.

### Native apps

```bash
cd client
echo "VITE_API_URL=https://your-api.example.com" > .env   # native builds can't use the dev proxy
npx cap add android            # once
npx cap add ios                # once (macOS + Xcode)
npm run cap:sync
npm run cap:android            # opens Android Studio
npm run cap:ios                # opens Xcode
```

Add camera permission strings: Android `CAMERA` in `AndroidManifest.xml`; iOS `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in `Info.plist`. Add `capacitor://localhost,http://localhost` to `CORS_ORIGINS` (already in `.env.example`).

## Flow

1. **Plant** — name/bed, crop, variety, planting date, method (soil / polybag / fertigation / hydroponic).
2. **Log** — up to 5 photos (camera or gallery) tagged by angle + pH, EC, temp, humidity, soil moisture, light, watering, fertiliser, symptoms.
   Photos are resized to 1600px JPEG on-device and blur-checked before upload.
3. **Analyse** — server runs:
   - **Rules engine** (`server/src/rules.ts`): readings vs crop profile → warn/critical flags + fixes. Deterministic, free, explainable.
   - **Claude vision** (`server/src/analyzer.ts`): photos + readings + plant age + rule flags + *previous log* → structured JSON via forced tool use, validated with zod.
4. **Result** — health score, verdict, confidence, out-of-range readings, prioritised actions with timeframe, likely issues with evidence, trend vs last log, re-check date, 👍/👎 feedback.
5. **History** — per-plant timeline + health score trend.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | engine status |
| GET | `/api/crops` | crop profiles |
| GET/POST | `/api/plants` | list / create |
| GET/DELETE | `/api/plants/:id` | detail with all logs |
| POST | `/api/plants/:id/observations` | multipart: `photos[]`, `angles[]`, readings |
| GET | `/api/observations/:id` | log + latest analysis |
| POST | `/api/observations/:id/analyze` | run / re-run analysis |
| PATCH | `/api/analyses/:id/feedback` | `{ helpful: boolean }` |

## Design notes / trade-offs

- **Crop ranges** in `server/src/crops.ts` are common starting values — tune per variety and growth stage. Next step: stage-specific ranges (seedling vs fruiting EC differs a lot).
- **Synchronous analysis** keeps the MVP simple (~5–20 s with AI). For scale, move to a queue (Azure Storage Queue / BullMQ) and poll.
- **SQLite + local disk** for dev. Production: Postgres/Azure SQL + Blob Storage with signed URLs. All DB access is in `index.ts`, easy to swap.
- **No auth yet.** Add before deploying (Clerk / Entra External ID / Supabase Auth); every table then gets a `user_id`.
- **Cost control**: on-device resize, ≤5 photos, one call per analyse. Add per-user daily limits before going public.
- **Feedback** is stored on each analysis — that becomes your labelled dataset for prompt tuning or a fine-tuned/edge model later.

## Roadmap

- **v2**: stage-aware crop profiles, reminders (re-check date → push notification), weather auto-fill from GPS, reading charts (pH/EC over time), PDF report export.
- **v3**: offline capture + background sync (IndexedDB queue), IoT sensor ingestion (ESP32 pH/EC/temp → API), multi-user farms/roles, Malay/Chinese UI.
