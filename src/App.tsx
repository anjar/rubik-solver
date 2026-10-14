'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePwa } from './lib/usePwa';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, CircleHelp, Download, Grid2X2, Lightbulb, LoaderCircle, Play, RotateCcw, ScanLine, ShieldCheck, Undo2, WifiOff, X } from 'lucide-react';
import { CubeView } from './components/CubeView';
import { FaceEditor } from './components/FaceEditor';
import { Scanner } from './components/Scanner';
import { Playground } from './components/Playground';
import { COLORS, DEMO, FACES, FACE_NAMES, SCAN_INSTRUCTIONS, SCAN_ORDER, SOLVED, TOP_NEIGHBOR, colorCounts, describeMove, inverseMove, paintSticker, stateAt, toFacelets, toFaceMap, validateCube } from './lib/cube';
import type { Face, Sticker } from './lib/cube';
import { newSession, parseSession, SESSION_KEY } from './lib/session';
import type { Session } from './lib/session';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function loadSession() { try { return parseSession(localStorage.getItem(SESSION_KEY)); } catch { return null; } }

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<'home' | 'session'>('home');
  const [selected, setSelected] = useState<Face>('F');
  const [error, setError] = useState(''), [storageError, setStorageError] = useState(false);
  const [solving, setSolving] = useState(false), [solverStatus, setSolverStatus] = useState('');
  const [uncertain, setUncertain] = useState<number[]>([]);
  const [replay, setReplay] = useState(0), [animationDone, setAnimationDone] = useState(false), [undo, setUndo] = useState(false);
  const [resumeCheck, setResumeCheck] = useState(false), [editingReview, setEditingReview] = useState(false);
  const [help, setHelp] = useState(false), [restart, setRestart] = useState<Session['mode'] | null>(null), [recover, setRecover] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null), [installHelp, setInstallHelp] = useState(false);
  const [connected, setConnected] = useState(true);
  const worker = useRef<Worker | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { offlineReady: offline, needRefresh, updateServiceWorker } = usePwa();

  useEffect(() => { setSession(loadSession()); setConnected(navigator.onLine); }, []);

  useEffect(() => {
    if (!session) return;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [session]);
  useEffect(() => {
    const connectivity = () => setConnected(navigator.onLine);
    const prompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    const installed = () => setInstall(null);
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    window.addEventListener('beforeinstallprompt', prompt); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installed); worker.current?.terminate(); clearTimeout(timeout.current); };
  }, []);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }, [screen, session?.phase, session?.faceIndex, resumeCheck]);

  const patch = (values: Partial<Session>) => setSession(s => s ? { ...s, ...values } : s);
  const cancelSolve = () => { worker.current?.terminate(); worker.current = null; clearTimeout(timeout.current); setSolving(false); };
  const begin = (mode: Session['mode']) => {
    cancelSolve(); setSession(newSession(mode)); setScreen('session'); setError(''); setUncertain([]); setResumeCheck(false); setEditingReview(false); setUndo(false); setRestart(null); setRecover(false);
  };
  const requestStart = (mode: Session['mode']) => { if (session && session.phase !== 'done') setRestart(mode); else begin(mode); };
  const resume = () => { setScreen('session'); setError(''); setUndo(false); setAnimationDone(false); setResumeCheck(session?.phase === 'guide'); };
  const goHome = () => { cancelSolve(); setScreen('home'); setError(''); setUndo(false); };
  const solve = () => {
    if (!session || solving) return;
    const initial = toFacelets(session.faces), result = validateCube(initial);
    if (!result.ok) { setError(result.message); return; }
    setError('');
    if (result.cube.isSolved()) { patch({ initial, moves: [], step: 0, phase: 'done' }); return; }
    setSolving(true); setSolverStatus('Menyiapkan solver di perangkatmu…');
    try {
      const w = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      worker.current = w;
      const fail = (message: string) => { cancelSolve(); setError(message); };
      w.onmessage = (event: MessageEvent<{ type: string; message?: string; moves?: string[] }>) => {
        if (event.data.type === 'status') setSolverStatus(event.data.message ?? 'Menghitung…');
        else if (event.data.type === 'solution') {
          cancelSolve(); patch({ initial, moves: event.data.moves!, step: 0, phase: 'orient' });
          setUndo(false); setAnimationDone(false);
        } else fail(event.data.message ?? 'Solusi gagal dihitung. Coba lagi.');
      };
      w.onerror = () => fail('Solver belum bisa dijalankan. Muat ulang aplikasi saat online, lalu coba lagi.');
      timeout.current = setTimeout(() => fail('Perhitungan terlalu lama di perangkat ini. Tutup aplikasi lain, lalu coba hitung lagi.'), 60000);
      w.postMessage(initial);
    } catch { cancelSolve(); setError('Solver belum tersedia. Muat ulang aplikasi dan coba lagi.'); }
  };
  const showDemo = () => {
    const s = { ...newSession('manual'), phase: 'review' as const, faces: toFaceMap(DEMO), demo: true };
    if (session && session.phase !== 'done') return;
    setSession(s); setScreen('session'); setError('');
  };
  const installApp = async () => {
    if (!install) { setInstallHelp(true); return; }
    try { await install.prompt(); await install.userChoice; } finally { setInstall(null); }
  };

  const face = SCAN_ORDER[session?.faceIndex ?? 0];
  const changeSticker = (index: number, color: Face) => {
    if (!session) return;
    const result = paintSticker(session.faces, face, index, color);
    setError(result.error ?? '');
    if (!result.error) { patch({ faces: result.faces }); setUncertain(u => u.filter(n => n !== index)); }
  };
  const facelets = session ? toFacelets(session.faces) : DEMO;
  const current = session?.initial ? stateAt(session.initial, session.moves, session.step) : facelets;
  const activeMove = session?.moves[undo ? session.step - 1 : session.step];
  const move = activeMove ? undo ? inverseMove(activeMove) : activeMove : undefined;
  const instruction = move ? describeMove(move) : null;
  const orientation = session?.phase === 'orient' || resumeCheck;
  const completedFaces = session ? SCAN_ORDER.filter(f => !session.faces[f].includes('?')).length : 0;
  const stage = !session || session.phase === 'input' ? 0 : session.phase === 'review' ? 1 : session.phase === 'done' ? 3 : 2;
  const mark = <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;

  return <div className="app">
    <a className="skip-link" href="#main">Lewati ke konten</a>
    <header className="header shell">
      <button className="brand" onClick={goHome} aria-label="Rubik Pandu, beranda">{mark}<span>rubik<span className="brand-light">pandu</span><span className="brand-dot">.</span></span></button>
      <div className="header-actions">
        <span className={`connection ${offline ? 'ready' : ''}`}><span className="status-dot" />{!connected ? 'Offline' : offline ? 'Siap offline' : '3×3 solver'}</span>
        <button className="icon-button" onClick={() => setHelp(true)} aria-label="Bantuan"><CircleHelp size={21} /></button>
      </div>
    </header>

    <main id="main" className="shell main">
      {storageError && <div className="notice error" role="alert">Penyimpanan perangkat tidak tersedia. Kamu masih bisa melanjutkan, tetapi sesi ini akan hilang jika aplikasi ditutup.</div>}
      {screen === 'home' ? <>
        <div className="home-layout">
          <section className="home-intro">
            <p className="intro-label"><span />Rubik 3×3, kita selesaikan.</p>
            <h1 tabIndex={-1} ref={titleRef}>Dari acak,<br />jadi beres.</h1>
            <p className="lead">Scan Rubikmu. Ikuti gerakannya.<br className="desktop-break" /> Satu putaran, selangkah lebih dekat.</p>
            <div className="home-actions">
              <button className="button primary" onClick={() => requestStart('scan')}><Camera size={21} />Scan Rubik<ArrowRight size={19} /></button>
              <button className="button secondary" onClick={() => requestStart('manual')}><Grid2X2 size={19} />Isi manual</button>
            </div>
            <p className="quiet-note"><ShieldCheck size={15} />Tanpa akun. Gambar tetap di perangkatmu.</p>
          </section>
          <div className="home-visual">
            <div className="visual-label"><span className="tiny-square" />RUANG LATIHAN<span>3 × 3</span></div>
            <Playground />
            <div className="visual-bottom"><span>Latihan bebas. Sesi Rubikmu tetap tersimpan.</span><span className="cube-colors" aria-hidden="true">{FACES.map(f => <i key={f} className={`color-${f}`} />)}</span></div>
          </div>
        </div>
        {session && session.phase !== 'done' && <section className="resume-strip">
          <div><span className="resume-icon"><RotateCcw size={21} /></span><div><strong>Lanjutkan dari terakhir?</strong><p>{session.phase === 'guide' ? `${session.step} dari ${session.moves.length} gerakan sudah kamu konfirmasi.` : `${completedFaces} dari 6 sisi sudah terisi.`}{session.demo ? ' Sesi contoh.' : ''}</p></div></div>
          <button className="button secondary" onClick={resume}>Lanjutkan<ArrowRight size={17} /></button>
        </section>}
        <section className="how-section" aria-labelledby="how-title">
          <div className="how-heading"><h2 id="how-title">Pelan-pelan,<br />sampai selesai.</h2><p>Belum tahu notasi Rubik?<br />Tidak masalah.</p></div>
          <ol className="how-steps">
            <li><span>01</span><div><h3>Kenalkan Rubikmu</h3><p>Scan keenam sisinya atau isi warna secara manual.</p></div></li>
            <li><span>02</span><div><h3>Cocokkan warnanya</h3><p>Periksa hasilnya. Ketuk kotak untuk memperbaiki warna.</p></div></li>
            <li><span>03</span><div><h3>Ikuti setiap putaran</h3><p>Panduan 3D menemani, satu gerakan setiap langkah.</p></div></li>
          </ol>
        </section>
        {(!session || session.phase === 'done') && <button className="text-button demo-link" onClick={showDemo}><Play size={15} />Lihat panduan dengan Rubik contoh<ArrowRight size={15} /></button>}
      </> : session && <>
        <div className="flow-top"><button className="text-button" onClick={goHome}><ArrowLeft size={17} />Beranda</button><span>{session.demo ? 'Rubik contoh' : 'Sesi tersimpan di perangkat'}</span></div>
        <ol className="stepper" aria-label="Tahapan penyelesaian">{['Masukkan Rubik', 'Periksa warna', 'Ikuti panduan'].map((label, i) => <li className={stage === i ? 'active' : stage > i ? 'complete' : ''} key={label} aria-current={stage === i ? 'step' : undefined}><span>{stage > i ? <Check size={15} /> : i + 1}</span><b>{label}</b>{i < 2 && <ChevronRight size={15} className="step-chevron" />}</li>)}</ol>
        {session.demo && <div className="notice">Ini Rubik contoh untuk mencoba panduan. Untuk Rubik asli, mulai dengan scan atau input manual.</div>}

        {session.phase === 'input' && <>
          <div className="page-heading"><div><p className="overline">Sisi {session.faceIndex + 1} dari 6</p><h1 ref={titleRef} tabIndex={-1}>Kenalkan sisi {COLORS[face].name.toLowerCase()}.</h1></div><div className="mode-switch" aria-label="Metode input"><button aria-pressed={session.mode === 'scan'} onClick={() => { patch({ mode: 'scan' }); setError(''); }}><Camera size={16} />Kamera</button><button aria-pressed={session.mode === 'manual'} onClick={() => patch({ mode: 'manual' })}><Grid2X2 size={16} />Manual</button></div></div>
          <div className="input-layout">
            <section className="input-surface">
              <div className="face-reference"><span className={`color-dot color-${TOP_NEIGHBOR[face]}`} />Tepi atas gambar: sisi {COLORS[TOP_NEIGHBOR[face]].name.toLowerCase()}</div>
              {session.mode === 'scan' && session.faces[face].includes('?') ? <Scanner key={face} face={face} onCapture={(colors, doubts) => { patch({ faces: { ...session.faces, [face]: colors } }); setUncertain(doubts); setError(''); }} onManual={() => patch({ mode: 'manual' })} /> : <>
                <FaceEditor face={face} values={session.faces[face]} selected={selected} onSelect={setSelected} uncertain={uncertain} counts={colorCounts(session.faces)} onChange={changeSticker}
                  preview={session.mode === 'manual' ? <CubeView facelets={facelets} editFace={face} onStickerClick={i => changeSticker(i, selected)} /> : undefined} />
                {error && <div className="notice error" role="alert">{error}</div>}
                {uncertain.length > 0 && <p className="notice">Kotak bertanda garis putus-putus perlu diperiksa lebih teliti.</p>}
                {session.mode === 'scan' && <button className="text-button rescan" onClick={() => { patch({ faces: { ...session.faces, [face]: Array.from({ length: 9 }, (_, i) => i === 4 ? face : '?') as Sticker[] } }); setUncertain([]); }}><ScanLine size={16} />Scan ulang sisi ini</button>}
              </>}
            </section>
            <aside className="input-guide">
              <span className={`face-center color-${face}`}>{COLORS[face].short}</span>
              <h2>Pusat {COLORS[face].name.toLowerCase()} menghadapmu.</h2>
              <p>{SCAN_INSTRUCTIONS[face]}</p>
              <div className="tip"><Lightbulb size={20} /><p>Putar <strong>seluruh Rubik</strong> saat berpindah sisi. Susunan kotaknya jangan diubah dulu.</p></div>
              <div className="face-progress" aria-label="Sisi yang sudah diisi">{SCAN_ORDER.map((f, i) => <button key={f} aria-label={`Edit sisi ${COLORS[f].name.toLowerCase()}`} aria-current={i === session.faceIndex ? 'step' : undefined} className={i === session.faceIndex ? 'selected' : ''} onClick={() => { patch({ faceIndex: i }); setUncertain([]); }}><span className={`color-${f}`}>{!session.faces[f].includes('?') ? <Check size={16} /> : i + 1}</span><small>{COLORS[f].name}</small></button>)}</div>
              <div className="input-next"><button className="button primary full" disabled={session.faces[face].includes('?')} onClick={() => { setUncertain([]); if (editingReview || session.faceIndex === 5) { patch({ phase: 'review' }); setEditingReview(false); } else patch({ faceIndex: session.faceIndex + 1 }); }}>{editingReview || session.faceIndex === 5 ? 'Periksa semua sisi' : 'Sisi selanjutnya'}<ArrowRight size={18} /></button><p className="small muted">Pastikan warna dan arah atas sudah cocok.</p></div>
            </aside>
          </div>
        </>}

        {session.phase === 'review' && <>
          <div className="page-heading"><div><h1 ref={titleRef} tabIndex={-1}>Sudah sama dengan Rubikmu?</h1><p>Periksa keenam sisi. Ketuk sisi yang perlu diperbaiki.</p></div></div>
          <div className="review-layout">
            <div className="review-faces">{SCAN_ORDER.map((f, i) => <button className="review-face" key={f} disabled={solving} aria-label={`Perbaiki sisi ${COLORS[f].name.toLowerCase()}`} onClick={() => { patch({ phase: 'input', faceIndex: i, mode: 'manual' }); setEditingReview(true); setError(''); }}><span className="review-face-label">{FACE_NAMES[f]}<span>{COLORS[f].name}</span></span><span className="mini-grid">{session.faces[f].map((c, n) => <span key={n} className={`color-${c === '?' ? 'unknown' : c}`}>{n === 4 ? '•' : c === '?' ? '?' : ''}</span>)}</span><small>Atas gambar: {COLORS[TOP_NEIGHBOR[f]].name.toLowerCase()}</small></button>)}</div>
            <aside className="review-aside"><CubeView facelets={facelets} compact /><h2>Setiap warna, 9 kotak.</h2><div className="color-counts">{FACES.map(f => { const count = [...facelets].filter(c => c === f).length; return <span key={f} className={count !== 9 ? 'count-wrong' : ''}><i className={`color-${f}`} />{COLORS[f].name}<b>{count}/9</b></span>; })}</div>
              {error && <div className="notice error" role="alert">{error}</div>}
              {solving ? <div className="solver-busy" role="status"><LoaderCircle className="spin" size={25} /><strong>{solverStatus}</strong><p>Ini bisa memerlukan beberapa saat. Layar boleh tetap terbuka.</p><button className="text-button" onClick={cancelSolve}>Batalkan</button></div> : <button className="button primary full" onClick={solve}>Cari solusi<ArrowRight size={18} /></button>}
            </aside>
          </div>
        </>}

        {orientation && <>
          <div className="page-heading"><div><h1 ref={titleRef} tabIndex={-1}>{resumeCheck ? 'Cocokkan sebelum melanjutkan.' : 'Pegang seperti ini, ya.'}</h1><p>{resumeCheck ? 'Model menunjukkan kondisi setelah gerakan terakhir yang kamu konfirmasi.' : `Solusimu siap: ${session.moves.length} gerakan. Mulai dengan posisi yang sama.`}</p></div></div>
          <div className="guide-layout"><div className="guide-visual"><CubeView facelets={current} /><OrientationLabels /></div><aside className="instruction-panel"><span className="step-number">{resumeCheck ? 'LANJUT SESI' : 'SEBELUM MULAI'}</span><h2>Pusat putih di atas.<br />Pusat hijau di depan.</h2><p>Pusat merah berada di kananmu. Pertahankan posisi ini selama mengikuti gerakan.</p><div className="tip"><Lightbulb size={20} /><p>{resumeCheck ? 'Kalau kamu sudah memutar Rubik sejak terakhir, scan ulang kondisi sekarang.' : 'Letakkan HP di depanmu agar kedua tangan bebas memegang Rubik.'}</p></div><button className="button primary full" onClick={() => { patch({ phase: 'guide' }); setResumeCheck(false); setUndo(false); setAnimationDone(false); setReplay(r => r + 1); }}>Sudah cocok, mulai<Play size={18} /></button><button className="text-button" onClick={() => setRecover(true)}>Rubikku berbeda</button></aside></div>
        </>}

        {session.phase === 'guide' && !resumeCheck && instruction && <>
          <div className="page-heading"><div><p className="overline">{undo ? 'Batalkan gerakan terakhir' : 'Tidak perlu buru-buru'}</p><h1 ref={titleRef} tabIndex={-1}>{undo ? 'Kembalikan satu gerakan.' : 'Ikuti putarannya.'}</h1></div><span className="guide-counter"><b>{session.step}</b> / {session.moves.length} selesai</span></div>
          <div className="progress-track" role="progressbar" aria-label="Gerakan selesai" aria-valuemin={0} aria-valuemax={session.moves.length} aria-valuenow={session.step}><span style={{ width: `${session.step / session.moves.length * 100}%` }} /></div>
          <div className="guide-layout"><div className="guide-visual"><CubeView facelets={current} move={move} replay={replay} onComplete={() => setAnimationDone(true)} /><OrientationLabels /><div className="animation-label" aria-live="polite">{animationDone ? 'Ini posisi setelah gerakan. Cocokkan dengan Rubikmu.' : 'Perhatikan lapisan yang bergerak…'}</div></div>
            <aside className="instruction-panel"><div className="instruction-top"><span className="step-number">{undo ? `BATALKAN LANGKAH ${session.step}` : `LANGKAH ${session.step + 1}`}</span><span className="notation" title="Notasi gerakan Rubik">{move}</span></div><h2 aria-live="polite">{instruction.title}.</h2><p>{instruction.detail}</p><div className="active-face"><i className={`color-${instruction.face}`} />Sisi dengan pusat {COLORS[instruction.face].name.toLowerCase()}</div>
              <button className="button secondary full" onClick={() => { setAnimationDone(false); setReplay(r => r + 1); }}><RotateCcw size={17} />Ulangi animasi</button>
              <button className="button primary full" disabled={!animationDone} onClick={() => {
                if (undo) { patch({ step: session.step - 1 }); setUndo(false); }
                else if (session.step + 1 === session.moves.length) patch({ step: session.step + 1, phase: 'done' });
                else patch({ step: session.step + 1 });
                setAnimationDone(false); setReplay(r => r + 1);
              }}>{undo ? 'Sudah dibatalkan' : session.step + 1 === session.moves.length ? 'Sudah, selesai!' : 'Sudah, lanjut'}<Check size={18} /></button>
              <p className="small muted">Tekan setelah kamu melakukan gerakannya pada Rubik asli.</p>
              {!undo && session.step > 0 && <button className="text-button" onClick={() => { setUndo(true); setAnimationDone(false); setReplay(r => r + 1); }}><Undo2 size={16} />Batalkan langkah sebelumnya</button>}
              <button className="text-button recovery-link" onClick={() => setRecover(true)}>Rubikku berbeda</button>
            </aside>
          </div>
        </>}

        {session.phase === 'done' && <div className="done-layout"><div className="done-visual"><CubeView facelets={SOLVED} /></div><section><span className="success-mark"><CheckCircle2 size={30} /></span><h1 ref={titleRef} tabIndex={-1}>{session.moves.length ? 'Beres. Kamu berhasil!' : 'Rubikmu sudah selesai.'}</h1><p className="lead">{session.demo ? 'Panduan contoh selesai. Sekarang coba dengan Rubikmu sendiri.' : session.moves.length ? `${session.moves.length} gerakan, satu Rubik terselesaikan. Nikmati hasil putaranmu.` : 'Keenam sisi sudah memiliki warna yang sama. Tidak ada gerakan yang diperlukan.'}</p><button className="button primary" onClick={() => begin('scan')}><Camera size={19} />Scan Rubik baru</button><button className="text-button" onClick={goHome}>Kembali ke beranda<ArrowRight size={16} /></button><button className="text-button" onClick={() => setRecover(true)}>Rubik asliku belum selesai</button></section></div>}
      </>}
    </main>

    <footer className="footer shell"><span><span className="footer-mark">↳</span> Satu putaran setiap langkah.</span><div><span className="footer-offline"><WifiOff size={14} />{offline ? 'Siap dipakai offline' : !connected ? 'Sedang offline' : 'Offline setelah siap'}</span><button onClick={() => void installApp()}><Download size={15} />Pasang aplikasi</button></div></footer>
    {needRefresh && <div className="update-banner"><span>Versi baru tersedia. Sesi terakhir tetap tersimpan.</span><button className="button secondary" onClick={updateServiceWorker}>Perbarui</button></div>}

    {help && <Modal title="Sedikit bantuan sebelum mulai" onClose={() => setHelp(false)}><p>Gunakan Rubik 3×3 standar: pusat putih berlawanan dengan kuning, hijau dengan biru, dan merah dengan oranye. Saat putih di atas dan hijau di depan, merah ada di kanan.</p><h3>Saat scan</h3><p>Hadapkan satu sisi ke kamera, sejajarkan kotaknya, lalu ambil gambar. Periksa setiap warna dan ikuti petunjuk tepi atas. Jangan putar lapisan Rubik selama scan.</p><h3>Saat mengikuti panduan</h3><p>Animasi adalah contoh gerakan. Lakukan pada Rubik asli, baru tekan “Sudah, lanjut”. Jika belum melakukan gerakan yang sedang ditampilkan, jangan menekan lanjut.</p><h3>Kalau salah putar</h3><p>“Batalkan langkah sebelumnya” hanya membatalkan gerakan terakhir yang sudah kamu konfirmasi. Jika kamu melakukan gerakan lain atau tidak yakin, pilih “Rubikku berbeda” untuk scan ulang.</p><h3>Offline dan privasi</h3><p>Gambar kamera tidak diunggah atau disimpan. Hanya warna, solusi, dan langkah terakhir tersimpan di perangkat. Tunggu label “Siap offline” sebelum memutus internet. Menghapus data situs juga menghapus sesi.</p></Modal>}
    {restart && <Modal title="Mulai dengan Rubik baru?" onClose={() => setRestart(null)}><p>Sesi terakhir akan diganti. Kalau ingin melanjutkannya, pilih “Kembali ke sesi”.</p><div className="modal-actions"><button className="button primary" onClick={() => begin(restart)}>Mulai sesi baru</button><button className="button secondary" onClick={() => { setRestart(null); resume(); }}>Kembali ke sesi</button></div></Modal>}
    {recover && <Modal title="Kita cocokkan dari kondisi sekarang." onClose={() => setRecover(false)}><p>Kalau kamu hanya berganti pegangan, kembalikan pusat putih ke atas dan hijau ke depan. Jika susunan kotaknya berbeda, scan ulang seluruh sisi tanpa memutar lapisannya. Solusi lama akan diganti.</p><div className="modal-actions"><button className="button primary" onClick={() => begin('scan')}><Camera size={18} />Scan ulang</button><button className="button secondary" onClick={() => begin('manual')}><Grid2X2 size={18} />Isi manual</button><button className="text-button" onClick={() => setRecover(false)}>Kembali ke panduan</button></div></Modal>}
    {installHelp && <Modal title="Simpan di layar utama" onClose={() => setInstallHelp(false)}><p><strong>Android Chrome:</strong> buka menu ⋮, lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.</p><p><strong>iPhone Safari:</strong> tekan Bagikan, lalu “Tambah ke Layar Utama”.</p><p>Jika pilihan belum muncul, gunakan aplikasi langsung dari browser. Tunggu label “Siap offline” sebelum memutus internet.</p></Modal>}
  </div>;
}

function OrientationLabels() { return <div className="orientation-labels"><span><i className="color-U" />Putih di atas</span><span><i className="color-F" />Hijau di depan</span><span><i className="color-R" />Merah di kanan</span></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} aria-labelledby="modal-title"><div className="modal-body"><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={21} /></button></div>{children}</div></dialog>;
}
