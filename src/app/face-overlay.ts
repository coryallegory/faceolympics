import type { FaceDebugFrame } from '../game/input/face/FaceInputService';

export interface OverlayPath {
  readonly name: string;
  readonly color: string;
  readonly points: readonly number[];
}

export const overlayPaths: readonly OverlayPath[] = [
  { name: 'Face outline',      color: '#2dd4ff', points: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10] },
  { name: 'Left eye',          color: '#7c3aed', points: [33,160,158,133,153,144,33] },
  { name: 'Right eye',         color: '#8b5cf6', points: [263,387,385,362,380,373,263] },
  { name: 'Left pupil / iris', color: '#facc15', points: [468,469,470,471,472,468] },
  { name: 'Right pupil / iris',color: '#fde047', points: [473,474,475,476,477,473] },
  { name: 'Left eyebrow',      color: '#22c55e', points: [70,63,105,66,107] },
  { name: 'Right eyebrow',     color: '#16a34a', points: [336,296,334,293,300] },
  { name: 'Mouth',             color: '#fb7185', points: [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61] },
] as const;

export function drawFaceOverlay(ctx: CanvasRenderingContext2D, frame: FaceDebugFrame, width: number, height: number): void {
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = '#001828';
  ctx.shadowBlur = 5;

  for (const path of overlayPaths) {
    const mapped = path.points.every((i) => frame.landmarks[i])
      ? path.points.map((i) => [1 - frame.landmarks[i].x, frame.landmarks[i].y] as const)
      : null;
    if (!mapped) continue;

    ctx.beginPath();
    for (const [idx, [x, y]] of mapped.entries()) {
      if (idx === 0) ctx.moveTo(x * width, y * height);
      else ctx.lineTo(x * width, y * height);
    }
    ctx.strokeStyle = path.color;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = path.color;
    for (const [x, y] of mapped) {
      ctx.beginPath();
      ctx.arc(x * width, y * height, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 5;
  }
}
