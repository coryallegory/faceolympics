/* global fetch, Buffer, console */
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repoRoot, 'node_modules/@mediapipe/tasks-vision/wasm');
const target = resolve(repoRoot, 'public/mediapipe/tasks-vision/wasm');

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

// Best-effort local cache of the face landmarker model, pinned to the same version
// as the CDN fallback in FaceInputService.ts. If this fails (e.g. no network on a
// clean checkout), FaceInputService still falls back to fetching the pinned CDN URL
// directly at runtime, so this is not fatal.
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const modelDir = resolve(repoRoot, 'public/mediapipe/models');
const modelPath = resolve(modelDir, 'face_landmarker.task');

const alreadyCached = await stat(modelPath).then(() => true).catch(() => false);
if (!alreadyCached) {
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(modelDir, { recursive: true });
    await writeFile(modelPath, bytes);
    console.log(`Cached face_landmarker.task (${bytes.length} bytes) to ${modelPath}`);
  } catch (error) {
    console.warn(`Could not cache face_landmarker.task locally (${error.message}). FaceInputService will fetch it from the CDN at runtime.`);
  }
}
