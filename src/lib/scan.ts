import type { Face } from './cube';

export type RGB = [number, number, number];
export function classifyColor([r0, g0, b0]: RGB): { color: Face; uncertain: boolean } {
  const [r, g, b] = [r0 / 255, g0 / 255, b0 / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const saturation = max ? d / max : 0;
  let hue = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  let color: Face;
  if (saturation < 0.22) color = 'U';
  else if (hue < 12 || hue >= 345) color = 'R';
  else if (hue < 40) color = 'L';
  else if (hue < 78) color = 'D';
  else if (hue < 175) color = 'F';
  else color = 'B';
  const nearBoundary = saturation >= 0.22 && [12, 40, 78, 175, 345].some(v => Math.abs(hue - v) < 5);
  return { color, uncertain: max < 0.22 || (saturation >= 0.18 && saturation < 0.32) || nearBoundary || (hue > 275 && hue < 345) };
}

// The square preview uses object-fit: cover. Sample its central 78% grid,
// exactly matching .scan-grid in CSS, using medians to reject glare and seams.
export function sampleFace(video: HTMLVideoElement): { colors: Face[]; uncertain: number[] } {
  const side = Math.min(video.videoWidth, video.videoHeight);
  if (!side) throw new Error('Kamera belum siap. Tunggu sampai gambarnya muncul.');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 300;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Browser tidak dapat membaca gambar kamera. Coba input manual.');
  ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 300, 300);
  const colors: Face[] = [], uncertain: number[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 33 + ((i % 3) + 0.5) * 78, y = 33 + (Math.floor(i / 3) + 0.5) * 78;
    const pixels = ctx.getImageData(Math.round(x - 10), Math.round(y - 10), 20, 20).data;
    const channels: number[][] = [[], [], []];
    for (let p = 0; p < pixels.length; p += 4) for (let ch = 0; ch < 3; ch++) channels[ch].push(pixels[p + ch]);
    const rgb = channels.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]) as RGB;
    const detected = classifyColor(rgb);
    colors.push(detected.color);
    if (detected.uncertain) uncertain.push(i);
  }
  return { colors, uncertain };
}
