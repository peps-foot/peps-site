// src/components/PushBootstrap.tsx
'use client';
import { useEffect } from 'react';
import { getFcmToken, onForegroundMessage } from '../lib/firebaseClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,);

export default function PushBootstrap() {
  // --- 1er useEffect : abonnement / enregistrement du token ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Notification.permission !== "granted") return;

    (async () => {
      try {
        const [{ data }, token] = await Promise.all([
          supabase.auth.getUser(),
          getFcmToken(),
        ]);
        if (!token) return;

        const user_id = data.user?.id || null;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, platform: "web", user_id }),
        });

        localStorage.setItem("peps_push_token", token);
      } catch {
        // no-op
      }
    })();
  }, []);

  // --- 2e useEffect : réception en foreground ---
  useEffect(() => {
    let unsub: undefined | (() => void);
    let alive = true;
    const seenIds = new Set<string>();

    (async () => {
      unsub = await onForegroundMessage((p: any) => {
        if (!alive) return;

        const mid = p?.messageId || p?.data?.messageId;
        if (mid) {
          if (seenIds.has(mid)) {
            return; // évite les doublons
          }
          seenIds.add(mid);
        }

        console.log("[FG] payload=", p);
        const n = p?.notification || {};
        const d = p?.data || {};
        const title = n.title || d.title || "PEPS";
        const body = n.body || d.body || "";
        const icon = d.icon || "/icon-512x512.png";

        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready.then((reg) => {
            // --- Garde critique : showNotification peut être absent sur iOS ---
            if (typeof reg.showNotification !== "function") {
              return;
            }
            try {
              reg.showNotification(title, {
                body,
                icon,
                tag:
                  d.tag ||
                  `peps-reminder-${d.match_id || "noid"}-${Date.now()}`,
                // requireInteraction pas supporté iOS → on l’enlève
                renotify: true,
              } as any);
            } catch {
              // no-op
            }
          });
        }
      });
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, []);

  return null;
}
