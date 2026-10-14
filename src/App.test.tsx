// @vitest-environment jsdom
import { useEffect } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cube from 'cubejs';
import { App } from './App';
import { COLORS, SCAN_ORDER, SOLVED } from './lib/cube';
import { SESSION_KEY } from './lib/session';

vi.mock('./components/CubeView', () => ({
  CubeView: ({ facelets, move, replay, onComplete, editFace, onStickerClick }: { facelets: string; move?: string; replay?: number; onComplete?: () => void; editFace?: string; onStickerClick?: (index: number) => void }) => {
    useEffect(() => { if (move) onComplete?.(); }, [move, replay]);
    return <div aria-label="Model Rubik 3D" data-facelets={facelets} data-edit-face={editFace}>{editFace && Array.from({ length: 9 }, (_, i) => <button key={i} disabled={i === 4} onClick={() => onStickerClick?.(i)}>Kotak 3D {i + 1}</button>)}</div>;
  },
}));
vi.mock('./lib/usePwa', () => ({ usePwa: () => ({ offlineReady: true, needRefresh: false, updateServiceWorker: () => {} }) }));
class LocalWorker {
  onmessage: ((e: { data: object }) => void) | null = null;
  terminated = false;
  postMessage(initial: string) {
    queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: { type: 'solution', moves: Cube.fromString(initial).solve().trim().split(/\s+/) } }); });
  }
  terminate() { this.terminated = true; }
}

beforeAll(() => {
  Cube.initSolver();
  vi.stubGlobal('Worker', LocalWorker);
  // Node 26 exposes an unavailable native localStorage getter. Use a
  // standards-shaped fixture rather than that getter in DOM integration tests.
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return saved.size; },
    key: (i: number) => [...saved.keys()][i] ?? null,
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
    removeItem: (key: string) => { saved.delete(key); },
    clear: () => saved.clear(),
  });
  window.scrollTo = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

describe('beginner flows', () => {
  it('opens the playground fullscreen fallback and exits with Escape', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Buka fullscreen' }));
    expect(screen.getByRole('dialog', { name: 'Playground Rubik' })).toBeTruthy();
    expect(document.body.style.overflowY).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Playground Rubik' })).toBeNull();
    expect(document.body.style.overflowY).not.toBe('hidden');
  });
  it('edits the active 3D face live and blocks a tenth sticker of the selected color', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Isi manual' }));
    expect(screen.getByLabelText('Model Rubik 3D').getAttribute('data-edit-face')).toBe('F');
    await user.click(screen.getByRole('button', { name: 'Pilih biru' }));
    for (const i of [1, 2, 3, 4, 6, 7, 8, 9]) await user.click(screen.getByRole('button', { name: `Kotak 3D ${i}` }));
    expect((screen.getByRole('button', { name: 'Pilih biru' }) as HTMLButtonElement).disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).faces.F[0]).toBe('B');
    await user.click(screen.getByRole('button', { name: 'Sisi selanjutnya' }));
    expect(screen.getByLabelText('Model Rubik 3D').getAttribute('data-edit-face')).toBe('R');
    await user.click(screen.getByRole('button', { name: 'Kotak 3D 1' }));
    expect(screen.getByRole('alert').textContent).toContain('9 kotak');
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).faces.R[0]).toBe('?');
  });
  it('fills all six faces manually and recognizes an already solved physical cube', async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Isi manual' }));
    await user.click(screen.getByText('Isi lewat grid 2D'));
    for (const [fi, face] of SCAN_ORDER.entries()) {
      await user.click(screen.getByRole('button', { name: `Pilih ${COLORS[face].name.toLowerCase()}` }));
      for (const button of screen.getAllByRole('button', { name: /^Baris/ })) if (!(button as HTMLButtonElement).disabled) await user.click(button);
      await user.click(screen.getByRole('button', { name: fi === 5 ? 'Periksa semua sisi' : 'Sisi selanjutnya' }));
    }
    expect(screen.getByRole('heading', { name: 'Sudah sama dengan Rubikmu?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cari solusi' }));
    expect(screen.getByRole('heading', { name: 'Rubikmu sudah selesai.' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).initial).toBe(SOLVED);
  });

  it('solves, undoes a confirmed move, resumes at the correct state, and reaches completion', async () => {
    const user = userEvent.setup(); let view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Lihat panduan dengan Rubik contoh' }));
    await user.click(screen.getByRole('button', { name: 'Cari solusi' }));
    await screen.findByRole('heading', { name: 'Pegang seperti ini, ya.' });
    await user.click(screen.getByRole('button', { name: 'Sudah cocok, mulai' }));
    await user.click(screen.getByRole('button', { name: 'Sudah, lanjut' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).step).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Batalkan langkah sebelumnya' }));
    await user.click(screen.getByRole('button', { name: 'Sudah dibatalkan' }));
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).step).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Sudah, lanjut' }));
    view.unmount(); view = render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Lanjutkan' }));
    expect(screen.getByRole('heading', { name: 'Cocokkan sebelum melanjutkan.' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sudah cocok, mulai' }));
    const remaining = JSON.parse(localStorage.getItem(SESSION_KEY)!).moves.length - 1;
    for (let i = 0; i < remaining; i++) await user.click(screen.getByRole('button', { name: i === remaining - 1 ? 'Sudah, selesai!' : 'Sudah, lanjut' }));
    expect(screen.getByRole('heading', { name: 'Beres. Kamu berhasil!' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).phase).toBe('done');
  });

  it('keeps the manual fallback available when camera permissions are denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Scan Rubik' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Isi manual' }));
    expect(screen.getByRole('button', { name: 'Pilih hijau' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ambil sisi ini' })).toBeNull();
  });
});
