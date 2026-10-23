import type { CropProfile, Observation, Plant, PlantDetail } from "./types";

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
export const assetUrl = (path: string) => `${API_BASE}${path}`;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

export const api = {
  health: () => req<{ ok: boolean; engine: "claude" | "mock" }>("/api/health"),
  crops: () => req<CropProfile[]>("/api/crops"),
  plants: () => req<Plant[]>("/api/plants"),
  plant: (id: number) => req<PlantDetail>(`/api/plants/${id}`),
  createPlant: (p: Partial<Plant>) => req<Plant>("/api/plants", json("POST", p)),
  deletePlant: (id: number) => req<void>(`/api/plants/${id}`, { method: "DELETE" }),
  createObservation: (plantId: number, form: FormData) =>
    req<Observation>(`/api/plants/${plantId}/observations`, { method: "POST", body: form }),
  observation: (id: number) => req<Observation>(`/api/observations/${id}`),
  analyze: (id: number) => req<Observation>(`/api/observations/${id}/analyze`, { method: "POST" }),
  feedback: (analysisId: number, helpful: boolean) =>
    req<void>(`/api/analyses/${analysisId}/feedback`, json("PATCH", { helpful })),
};
