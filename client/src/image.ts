/** Resize + re-encode on device: faster uploads on mobile data, smaller AI payload, strips EXIF. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<{ blob: Blob; sharpness: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const sharpness = estimateSharpness(ctx, w, h);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), "image/jpeg", quality));
  return { blob, sharpness };
}

/**
 * Cheap blur check: variance of a Laplacian over a downscaled grayscale copy.
 * Low values ⇒ likely blurry. Threshold is empirical — tune with real field photos.
 */
function estimateSharpness(src: CanvasRenderingContext2D, w: number, h: number): number {
  const S = 256;
  const k = Math.min(1, S / Math.max(w, h));
  const sw = Math.max(3, Math.round(w * k)), sh = Math.max(3, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src.canvas, 0, 0, sw, sh);
  const d = ctx.getImageData(0, 0, sw, sh).data;
  const g = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
    const i = y * sw + x;
    const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - sw] - g[i + sw];
    sum += lap; sumSq += lap * lap; n++;
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export const BLUR_THRESHOLD = 60;
