import Cube from 'cubejs';

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = typeof FACES[number];
export type Sticker = Face | '?';
export type FaceMap = Record<Face, Sticker[]>;
export const SCAN_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];
export const COLORS: Record<Sticker, { name: string; hex: string; short: string }> = {
  U: { name: 'Putih', hex: '#f3f4ef', short: 'P' },
  R: { name: 'Merah', hex: '#e84943', short: 'M' },
  F: { name: 'Hijau', hex: '#32a875', short: 'H' },
  D: { name: 'Kuning', hex: '#f5cf42', short: 'K' },
  L: { name: 'Oranye', hex: '#f28a35', short: 'O' },
  B: { name: 'Biru', hex: '#4282d6', short: 'B' },
  '?': { name: 'Belum diisi', hex: '#cbd0ca', short: '·' },
};
export const FACE_NAMES: Record<Face, string> = {
  U: 'Atas', R: 'Kanan', F: 'Depan', D: 'Bawah', L: 'Kiri', B: 'Belakang',
};
export const TOP_NEIGHBOR: Record<Face, Face> = { F: 'U', R: 'U', B: 'U', L: 'U', U: 'B', D: 'F' };
export const SCAN_INSTRUCTIONS: Record<Face, string> = {
  F: 'Hadapkan pusat hijau ke kamera. Pusat putih menghadap ke atas. Sejajarkan sembilan kotak dengan bingkai.',
  R: 'Putar seluruh Rubik sampai pusat merah menghadap kamera. Pusat putih tetap di atas. Jangan putar satu lapisannya.',
  B: 'Lanjutkan memutar seluruh Rubik sampai pusat biru menghadap kamera. Pusat putih tetap di atas.',
  L: 'Lanjutkan memutar seluruh Rubik sampai pusat oranye menghadap kamera. Pusat putih tetap di atas.',
  U: 'Kembali ke pusat hijau di depan dan putih di atas. Miringkan seluruh Rubik agar sisi putih menghadap kamera. Sisi biru berada di tepi atas gambar.',
  D: 'Kembali ke pusat hijau di depan dan putih di atas. Miringkan seluruh Rubik agar sisi kuning menghadap kamera. Sisi hijau berada di tepi atas gambar.',
};
export const SOLVED = FACES.map(f => f.repeat(9)).join('');
export const DEMO = new Cube().move("R U R' U' F2 D L2 B U2 R2").asString();

export function emptyFaces(): FaceMap {
  return Object.fromEntries(FACES.map(f => [f, Array.from({ length: 9 }, (_, i) => i === 4 ? f : '?')])) as FaceMap;
}
export function toFaceMap(s: string): FaceMap {
  return Object.fromEntries(FACES.map((f, i) => [f, s.slice(i * 9, i * 9 + 9).split('')])) as FaceMap;
}
export function toFacelets(faces: FaceMap): string { return FACES.map(f => faces[f].join('')).join(''); }
export function colorCounts(faces: FaceMap): Record<Face, number> {
  const values = toFacelets(faces);
  return Object.fromEntries(FACES.map(f => [f, [...values].filter(c => c === f).length])) as Record<Face, number>;
}
export function paintSticker(faces: FaceMap, face: Face, index: number, color: Face): { faces: FaceMap; error?: string } {
  if (index === 4 || faces[face][index] === color) return { faces };
  if (colorCounts(faces)[color] >= 9) return { faces, error: `${COLORS[color].name} sudah berjumlah 9 kotak. Ganti kotak lain yang memakai warna itu sebelum menambahkannya di sini.` };
  const values = [...faces[face]];
  values[index] = color;
  return { faces: { ...faces, [face]: values } };
}
export function stateAt(initial: string, moves: string[], step: number): string {
  return new Cube(Cube.fromString(initial)).move(moves.slice(0, step).join(' ')).asString();
}
export function inverseMove(move: string): string { return Cube.inverse(move); }
function parity(p: number[]): number {
  let n = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) n++;
  return n % 2;
}
export type Validation = { ok: true; cube: Cube } | { ok: false; message: string };
export function validateCube(s: string): Validation {
  if (s.length !== 54 || /[^URFDLB]/.test(s)) return { ok: false, message: 'Masih ada kotak yang belum diisi. Lengkapi warna pada keenam sisi.' };
  for (const [i, f] of FACES.entries()) {
    const count = [...s].filter(c => c === f).length;
    if (count !== 9) return { ok: false, message: `${COLORS[f].name} berjumlah ${count} kotak; seharusnya 9. Periksa warna hasil scan atau inputmu.` };
    if (s[i * 9 + 4] !== f) return { ok: false, message: 'Warna pusat tidak sesuai. Gunakan Rubik standar: putih di atas, hijau di depan, merah di kanan.' };
  }
  try {
    const c = Cube.fromString(s);
    if (new Set(c.cp).size !== 8 || new Set(c.ep).size !== 12 || c.asString() !== s) {
      return { ok: false, message: 'Susunan warna belum membentuk Rubik yang valid. Periksa arah atas tiap sisi dan warna kotak, lalu scan ulang sisi yang berbeda.' };
    }
    if (c.co.reduce((a, b) => a + b, 0) % 3 || c.eo.reduce((a, b) => a + b, 0) % 2 || parity(c.cp) !== parity(c.ep)) {
      return { ok: false, message: 'Susunan ini tidak bisa diselesaikan dengan putaran biasa. Periksa warna dan orientasi scan. Jika semuanya benar, ada keping yang mungkin pernah diputar atau dipasang ulang.' };
    }
    return { ok: true, cube: c };
  } catch { return { ok: false, message: 'Susunan belum valid. Periksa kembali keenam sisi Rubik.' }; }
}

export type Vec3 = [number, number, number];
export function stickerPose(face: Face, index: number): { position: Vec3; normal: Vec3 } {
  const r = Math.floor(index / 3), c = index % 3;
  switch (face) {
    case 'U': return { position: [c - 1, 1, r - 1], normal: [0, 1, 0] };
    case 'R': return { position: [1, 1 - r, 1 - c], normal: [1, 0, 0] };
    case 'F': return { position: [c - 1, 1 - r, 1], normal: [0, 0, 1] };
    case 'D': return { position: [c - 1, -1, 1 - r], normal: [0, -1, 0] };
    case 'L': return { position: [-1, 1 - r, c - 1], normal: [-1, 0, 0] };
    case 'B': return { position: [1 - c, 1 - r, -1], normal: [0, 0, -1] };
  }
}
export function moveRotation(move: string): { axis: 'x' | 'y' | 'z'; layer: number; angle: number } {
  if (['M', 'E', 'S'].includes(move[0])) {
    const axis = ({ M: 'x', E: 'y', S: 'z' } as const)[move[0] as 'M' | 'E' | 'S'];
    const amount = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
    return { axis, layer: 0, angle: (move[0] === 'S' ? -1 : 1) * amount * Math.PI / 2 };
  }
  const face = move[0] as Face;
  const axis = ({ R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z' } as const)[face];
  const layer = ['R', 'U', 'F'].includes(face) ? 1 : -1;
  const amount = move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
  return { axis, layer, angle: -layer * amount * Math.PI / 2 };
}
export function sliceMove(axis: 'x' | 'y' | 'z', layer: number, direction: number): string {
  const move = ({ x: ['L', 'M', 'R'], y: ['D', 'E', 'U'], z: ['B', 'S', 'F'] } as const)[axis][layer + 1];
  const clockwise = moveRotation(move).angle;
  return Math.sign(clockwise) === Math.sign(direction) ? move : `${move}'`;
}
export function sliceMoves(axis: 'x' | 'y' | 'z', layers: number[], direction: number): string {
  return [...new Set(layers)].sort().map(layer => sliceMove(axis, layer, direction)).join(' ');
}
export function describeMove(move: string) {
  const f = move[0] as Face, reverse = move.endsWith("'"), twice = move.endsWith('2');
  const simple: Record<Face, [string, string]> = {
    R: ['Putar sisi kanan ke atas', 'Putar sisi kanan ke bawah'],
    L: ['Putar sisi kiri ke bawah', 'Putar sisi kiri ke atas'],
    U: ['Geser lapisan atas ke kiri', 'Geser lapisan atas ke kanan'],
    D: ['Geser lapisan bawah ke kanan', 'Geser lapisan bawah ke kiri'],
    F: ['Putar sisi depan ke kanan', 'Putar sisi depan ke kiri'],
    B: ['Putar sisi belakang searah jarum jam', 'Putar sisi belakang berlawanan jarum jam'],
  };
  return {
    title: twice ? `Putar sisi ${FACE_NAMES[f].toLowerCase()} setengah putaran` : simple[f][reverse ? 1 : 0],
    detail: twice ? 'Dua putaran 90° berturut-turut. Arah mana pun sama hasilnya.' : f === 'B' ? 'Arah dihitung saat melihat langsung sisi belakang. Geser model untuk melihat gerakannya.' : 'Putar hanya lapisan yang disorot, sebanyak 90°. Pertahankan posisi seluruh Rubik.',
    face: f,
  };
}
