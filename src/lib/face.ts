/**
 * Lightweight on-device facial biometric helper.
 *
 * Captures a real frame from the user's webcam, reduces it to a normalized
 * grayscale signature vector, and compares signatures using cosine similarity.
 * This runs entirely in the browser — no face image ever leaves the device,
 * only the derived numeric descriptor is stored.
 */

const GRID = 16; // 16x16 = 256-dimension descriptor

/** Capture a descriptor from a live <video> element. */
export function captureFaceDescriptor(video: HTMLVideoElement): number[] | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Center-crop to a square focused on the face region, then downscale.
  const size = Math.min(w, h);
  const sx = (w - size) / 2;
  const sy = (h - size) / 2;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, GRID, GRID);

  const { data } = ctx.getImageData(0, 0, GRID, GRID);
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Normalize (zero mean, unit variance) for robustness to lighting.
  const mean = gray.reduce((a, b) => a + b, 0) / gray.length;
  const variance = gray.reduce((a, b) => a + (b - mean) ** 2, 0) / gray.length;
  const std = Math.sqrt(variance) || 1;
  return gray.map((v) => (v - mean) / std);
}

/** Average several descriptors into one stable descriptor. */
export function averageDescriptors(list: number[][]): number[] {
  if (list.length === 0) return [];
  const len = list[0].length;
  const out = new Array(len).fill(0);
  for (const d of list) for (let i = 0; i < len; i++) out[i] += d[i];
  return out.map((v) => v / list.length);
}

/** Cosine similarity in [-1, 1]; higher = more similar. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Match threshold for verification. */
export const FACE_MATCH_THRESHOLD = 0.82;
