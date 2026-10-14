import { useEffect, useRef, useState } from 'react';

export function usePwa() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let alive = true;
    const register = async () => {
      try {
        const r = await navigator.serviceWorker.register('/sw.js');
        if (!alive) return;
        registration.current = r;
        if (r.active) setOfflineReady(true);
        if (r.waiting) setNeedRefresh(true);
        const trackInstall = () => {
          const w = r.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (!alive || w.state !== 'installed') return;
            if (navigator.serviceWorker.controller) setNeedRefresh(true);
            else setOfflineReady(true);
          });
        };
        r.addEventListener('updatefound', trackInstall);
        trackInstall();
        await navigator.serviceWorker.ready;
        if (alive) setOfflineReady(true);
      } catch { /* The app remains usable online; readiness is never claimed. */ }
    };
    void register();
    return () => { alive = false; };
  }, []);
  const updateServiceWorker = () => {
    const waiting = registration.current?.waiting;
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };
  return { offlineReady, needRefresh, updateServiceWorker };
}
