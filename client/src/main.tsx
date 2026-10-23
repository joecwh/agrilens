import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import "./styles.css";
import { api } from "./api";
import PlantList from "./pages/PlantList";
import NewPlant from "./pages/NewPlant";
import PlantView from "./pages/PlantView";
import NewObservation from "./pages/NewObservation";
import ObservationView from "./pages/ObservationView";

function App() {
  const [engine, setEngine] = useState<string | null>(null);
  useEffect(() => { api.health().then((h) => setEngine(h.engine)).catch(() => setEngine("offline")); }, []);

  return (
    // HashRouter works identically in browser, PWA and Capacitor webview (no server rewrites needed)
    <HashRouter>
      <header className="topbar">
        <Link to="/" className="brand">Agri<span>Lens</span></Link>
        {engine && <span className={`engine engine-${engine}`}>{engine === "claude" ? "AI" : engine}</span>}
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<PlantList />} />
          <Route path="/plants/new" element={<NewPlant />} />
          <Route path="/plants/:id" element={<PlantView />} />
          <Route path="/plants/:id/observe" element={<NewObservation />} />
          <Route path="/observations/:id" element={<ObservationView />} />
        </Routes>
      </main>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
