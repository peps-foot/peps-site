// Envoi manuel à 1 token précis (debug unitaire).
// Supporte FCM (Android/web) et Web Push natif (iOS).

export const runtime = 'nodejs';
import 'server-only';
import { messaging } from '../../../../lib/firebaseAdmin';

const webpush = require('web-push') as typeof import('web-push');

const VAPID_PUBLIC_KEY  = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';
const VAPID_PRIVATE_KEY = 'aDNoUdMC-E95kgkI4qI-HL76jvvybdFU7vBDxTgoW-0';

webpush.setVapidDetails(
  'mailto:contact@peps-foot.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

/** Un token iOS est un JSON stringifié contenant un champ "endpoint" */
function isIosToken(token: string): boolean {
  try {
    const parsed = JSON.parse(token);
    return typeof parsed.endpoint === 'string' && parsed.endpoint.includes('apple.com');
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const {
    token,
    title = 'PEPS',
    body  = 'Notif test',
    url   = 'https://www.peps-foot.com/',
  } = await req.json();

  if (!token) {
    return new Response(JSON.stringify({ error: 'token manquant' }), { status: 400 });
  }

  // ── iOS : Web Push natif ──
  if (isIosToken(token)) {
    try {
      const sub = JSON.parse(token) as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await webpush.sendNotification(
        sub,
        JSON.stringify({
          title,
          body,
          url,
          icon: '/images/notifications/peps-notif-icon-192.png',
          tag: 'peps-broadcast',
        }),
        { urgency: 'high', TTL: 10 }
      );
      return Response.json({ ok: true, platform: 'ios' });
    } catch (e: any) {
      return new Response(
        JSON.stringify({ error: e.message || 'iOS send failed', statusCode: e.statusCode }),
        { status: 500 }
      );
    }
  }

  // ── Android / web / twa : FCM ──
  try {
    const id = await messaging.send({
      token,
      webpush: {
        headers: { Urgency: 'high', TTL: '10', Topic: 'peps-send' },
        data: {
          title,
          body,
          url,
          icon: '/icon-512x512.png',
          tag: 'peps-broadcast',
        },
        fcmOptions: { link: url },
      },
    });
    return Response.json({ ok: true, platform: 'fcm', id });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || 'FCM send failed' }),
      { status: 500 }
    );
  }
}