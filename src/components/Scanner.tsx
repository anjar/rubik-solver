import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, ScanLine } from 'lucide-react';
import { COLORS } from '../lib/cube';
import type { Face } from '../lib/cube';
import { sampleFace } from '../lib/scan';

export function Scanner({ face, onCapture, onManual }: { face: Face; onCapture: (colors: Face[], uncertain: number[]) => void; onManual: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(''), [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    setReady(false);
    setError('');
    const start = async () => {
      try {
        if (!window.isSecureContext) throw new Error('Kamera memerlukan alamat HTTPS. Buka versi HTTPS atau gunakan input manual.');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di browser ini. Gunakan input manual.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); if (!cancelled) setReady(true); }
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : '';
        setError(name === 'NotAllowedError' ? 'Izin kamera belum diberikan. Izinkan kamera lewat pengaturan browser, lalu coba lagi. Kamu juga bisa mengisi warna secara manual.' : name === 'NotFoundError' ? 'Tidak ada kamera yang ditemukan. Gunakan input manual untuk melanjutkan.' : name === 'NotReadableError' ? 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.' : e instanceof Error ? e.message : 'Kamera gagal dibuka. Coba lagi atau gunakan input manual.');
      }
    };
    void start();
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()); };
  }, [attempt]);
  const capture = () => {
    if (!video.current) return;
    try {
      const result = sampleFace(video.current);
      if (result.colors[4] !== face) {
        setError(`Pusat terbaca ${COLORS[result.colors[4]].name.toLowerCase()}. Hadapkan pusat ${COLORS[face].name.toLowerCase()} ke kamera, perbaiki pencahayaan, atau gunakan input manual.`);
        return;
      }
      onCapture(result.colors, result.uncertain);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gambar gagal dibaca. Coba lagi.'); }
  };
  return <div className="scanner">
    <div className="camera-frame">
      <video ref={video} autoPlay playsInline muted aria-label="Tampilan kamera belakang" />
      {!ready && <div className="camera-wait"><Camera size={36} /><span>{error ? 'Kamera belum tersedia' : 'Membuka kamera…'}</span></div>}
      <div className="scan-grid" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i}>{i === 4 && <i className={`color-${face}`} />}</span>)}</div>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <button className="button primary full" onClick={capture} disabled={!ready}><ScanLine size={19} />Ambil sisi ini</button>
    {error && <div className="button-row"><button className="button secondary" onClick={() => setAttempt(a => a + 1)}><RefreshCw size={16} />Coba lagi</button><button className="button secondary" onClick={onManual}>Isi manual</button></div>}
    <p className="small muted">Gunakan cahaya merata. Hindari pantulan lampu pada kotak.</p>
  </div>;
}
