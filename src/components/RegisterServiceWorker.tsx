// components/RegisterServiceWorker.tsx
'use client';
import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
    }
  }, []);
  return null;
}
