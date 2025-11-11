// il est en doublon de /public/firebase-messaging-sw.js mais il faut le garder sinon ca plante.
'use client';
import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      //navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
      navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    }
  }, []);
  return null;
}
