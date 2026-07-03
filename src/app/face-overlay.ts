import type { FaceDebugFrame } from '../game/input/face/FaceInputService';
import type { FaceTriggers } from '../game/core/types';

type BooleanTriggerKey = { [K in keyof FaceTriggers]: FaceTriggers[K] extends boolean ? K : never }[keyof FaceTriggers];

export interface OverlayPath {
  readonly name: string;
  readonly color: string;
  readonly points: readonly number[];
  readonly renderAs?: 'circle'; // points[0]=center, points[1]=edge; radius computed from distance
  readonly hideWhen?: BooleanTriggerKey;  // skip draw when this FaceTriggers boolean is true
}

export const overlayPaths: readonly OverlayPath[] = [
  { name: 'Face outline',      color: '#2dd4ff', points: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10] },
  { name: 'Left eye',          color: '#7c3aed', points: [33,160,158,133,153,144,33] },
  { name: 'Right eye',         color: '#8b5cf6', points: [263,387,385,362,380,373,263] },
  { name: 'Left pupil / iris', color: '#facc15', points: [468, 469], renderAs: 'circle', hideWhen: 'blinkLeft' },
  { name: 'Right pupil / iris',color: '#fde047', points: [473, 474], renderAs: 'circle', hideWhen: 'blinkRight' },
  { name: 'Left eyebrow',      color: '#22c55e', points: [70,63,105,66,107] },
  { name: 'Right eyebrow',     color: '#16a34a', points: [336,296,334,293,300] },
  { name: 'Mouth outer',       color: '#fb7185', points: [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61] },
  { name: 'Mouth inner',       color: '#f97316', points: [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95,78] },
] as const;

// Maps a normalized MediaPipe landmark (0-1 in original video space) to canvas pixel
// coordinates, accounting for the mirrored video (CSS scaleX(-1)) and object-fit: cover cropping.
function makeLandmarkMapper(video: HTMLVideoElement, containerW: number, containerH: number) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(containerW / vw, containerH / vh);
  const cropX = (vw * scale - containerW) / 2;
  const cropY = (vh * scale - containerH) / 2;
  return (nx: number, ny: number): readonly [number, number] => [
    (1 - nx) * vw * scale - cropX,
    ny * vh * scale - cropY,
  ];
}

export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  frame: FaceDebugFrame,
  triggers: FaceTriggers,
  video: HTMLVideoElement,
  containerW: number,
  containerH: number,
): void {
  if (!video.videoWidth || !video.videoHeight) return;

  const toCanvas = makeLandmarkMapper(video, containerW, containerH);

  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = '#001828';
  ctx.shadowBlur = 5;

  for (const path of overlayPaths) {
    if (!path.points.every((i) => frame.landmarks[i])) continue;
    if (path.hideWhen && triggers[path.hideWhen]) continue;
    const mapped = path.points.map((i) => toCanvas(frame.landmarks[i].x, frame.landmarks[i].y));

    if (path.renderAs === 'circle') {
      const [cx, cy] = mapped[0];
      const [ex, ey] = mapped[1];
      const radius = Math.hypot(ex - cx, ey - cy);
      ctx.strokeStyle = path.color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = path.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 5;
    } else {
      ctx.beginPath();
      for (const [idx, [x, y]] of mapped.entries()) {
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = path.color;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = path.color;
      for (const [x, y] of mapped) {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 5;
    }
  }
}
