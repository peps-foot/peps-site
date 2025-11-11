// Envoi manuel à 1 token précis (debug unitaire).
// Utile pour test ciblé si un joueur ne reçoit pas.

export const runtime = 'nodejs';
import { messaging } from '../../../../lib/firebaseAdmin';

export async function POST(req: Request) {
  const { token, title = 'PEPS', body = 'Notif test', url = 'https://www.peps-foot.com/' } = await req.json();
  try {
    const id = await messaging.send({
      token,
      webpush: {
        headers: { Urgency: 'high', TTL: '10', Topic: 'peps-send' },
        // ⬇️ PAS de 'notification' ici. On passe tout en data.
        data: {
          title,
          body,
          url,
          icon: '/icon-512x512.png',
          tag: 'peps-broadcast'   // remplace la précédente au lieu d’empiler
        },
        fcmOptions: { link: url }
      }

    });
    return Response.json({ ok: true, id });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'send failed' }), { status: 500 });
  }
}
