import { LockKeyhole, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { COLORS, FACES } from '../lib/cube';
import type { Face, Sticker } from '../lib/cube';

export function FaceEditor({ face, values, selected, onSelect, onChange, uncertain = [], preview, counts }: {
  face: Face; values: Sticker[]; selected: Face; onSelect: (f: Face) => void;
  onChange: (index: number, color: Face) => void; uncertain?: number[];
  preview?: ReactNode; counts?: Record<Face, number>;
}) {
  const grid = <div className="face-grid" aria-label={`Editor sisi ${COLORS[face].name.toLowerCase()}`}>
    {values.map((color, i) => <button type="button" key={i} className={`sticker color-${color === '?' ? 'unknown' : color} ${uncertain.includes(i) ? 'uncertain' : ''}`} disabled={i === 4}
      aria-label={`Baris ${Math.floor(i / 3) + 1}, kolom ${i % 3 + 1}: ${COLORS[color].name}${i === 4 ? ', pusat terkunci' : ''}`}
      onClick={() => onChange(i, selected)}>
      {i === 4 ? <LockKeyhole size={17} /> : color === '?' ? <span>+</span> : <span className="sticker-letter">{COLORS[color].short}</span>}
    </button>)}
  </div>;
  return <div className="face-editor">
    {preview ?? grid}
    <p className="editor-caption">Pilih warna, lalu ketuk kotak yang ingin diubah.</p>
    <div className="palette" aria-label="Pilih warna">
      {FACES.map(f => <button type="button" key={f} disabled={counts && counts[f] >= 9} aria-pressed={selected === f} aria-label={`Pilih ${COLORS[f].name.toLowerCase()}`} title={counts?.[f] === 9 ? `${COLORS[f].name} sudah penuh (9/9)` : COLORS[f].name} className={`swatch ${selected === f ? 'selected' : ''}`} onClick={() => onSelect(f)}>
        <span className={`swatch-color color-${f}`}>{selected === f && <Check size={18} />}</span><span>{COLORS[f].name}</span>{counts && <small>{counts[f]}/9</small>}
      </button>)}
    </div>
    {counts && <p className="palette-caption">Jumlah dihitung dari seluruh sisi. Maksimal 9 per warna.</p>}
    {preview && <details className="manual-grid-fallback"><summary>Isi lewat grid 2D</summary>{grid}</details>}
  </div>;
}
