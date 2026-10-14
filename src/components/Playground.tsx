import { useEffect, useRef, useState } from 'react';
import Cube from 'cubejs';
import { Maximize, Minimize, RotateCcw, Shuffle, Undo2 } from 'lucide-react';
import { DEMO, SOLVED, inverseMove } from '../lib/cube';
import { CubeView } from './CubeView';

export function Playground() {
  const [facelets, setFacelets] = useState(DEMO);
  const [history, setHistory] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const container = useRef<HTMLDivElement>(null), fullscreenButton = useRef<HTMLButtonElement>(null);
  const nativeFullscreen = useRef(false);
  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === container.current) { nativeFullscreen.current = true; setExpanded(true); }
      else if (nativeFullscreen.current) { nativeFullscreen.current = false; setExpanded(false); }
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    fullscreenButton.current?.focus();
    return () => { document.body.style.overflowY = previous; fullscreenButton.current?.focus(); };
  }, [expanded]);
  const close = async () => {
    if (document.fullscreenElement === container.current) {
      try { await document.exitFullscreen(); } catch { return; }
    }
    setExpanded(false);
  };
  const open = async () => {
    setExpanded(true);
    try { await container.current?.requestFullscreen?.(); } catch { /* Fill the viewport if native fullscreen is unavailable. */ }
  };
  const turn = (move: string) => {
    setFacelets(s => Cube.fromString(s).move(move).asString());
    setHistory(moves => [...moves, move]);
  };
  return <div ref={container} className={`playground ${expanded ? 'is-fullscreen' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-label="Playground Rubik"
    onKeyDown={event => {
      if (!expanded) return;
      if (event.key === 'Escape') { event.preventDefault(); void close(); }
      if (event.key === 'Tab') {
        const buttons = [...container.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    <div className="playground-toolbar"><strong>Ruang latihan</strong><button ref={fullscreenButton} className="icon-button playground-expand" aria-label={expanded ? 'Keluar fullscreen' : 'Buka fullscreen'} title={expanded ? 'Keluar fullscreen' : 'Layar penuh'} onClick={() => { if (expanded) void close(); else void open(); }}>{expanded ? <Minimize size={18} /> : <Maximize size={18} />}</button></div>
    <CubeView facelets={facelets} simulator onTurn={turn} />
    <div className="playground-controls">
      <button className="text-button" onClick={() => { setFacelets(Cube.random().asString()); setHistory([]); }}><Shuffle size={14} />Acak</button>
      <button className="text-button" disabled={!history.length} onClick={() => {
        const previous = history.at(-1);
        if (previous) { setFacelets(s => Cube.fromString(s).move(inverseMove(previous)).asString()); setHistory(moves => moves.slice(0, -1)); }
      }}><Undo2 size={14} />Undo</button>
      <button className="text-button" onClick={() => { setFacelets(SOLVED); setHistory([]); }}><RotateCcw size={14} />Reset</button>
    </div>
    <p className="playground-status" aria-live="polite">{history.length ? `${history.length} putaran · Terakhir: ${history.at(-1)}` : 'Tiap jari mengatur barisnya sendiri, boleh berlawanan arah.'}</p>
  </div>;
}
