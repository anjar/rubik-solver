import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/plus-jakarta-sans';
import '../styles.css';

export const metadata: Metadata = {
  title: 'Rubik Pandu — Satu putaran, selangkah lebih dekat.',
  description: 'Selesaikan Rubik 3×3 dengan scan kamera dan panduan gerakan 3D. Tanpa akun, tanpa upload gambar, dan bisa offline.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Rubik Pandu', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#f8f9f5', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
