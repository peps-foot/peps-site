'use client'

import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.log('✅ Service Worker enregistré'))
        .catch((err) => console.warn('❌ Échec enregistrement SW :', err));
    }
  }, []);

  return null;
}
