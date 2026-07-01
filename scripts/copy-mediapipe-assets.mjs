import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repoRoot, 'node_modules/@mediapipe/tasks-vision/wasm');
const target = resolve(repoRoot, 'dist/mediapipe/tasks-vision/wasm');

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
