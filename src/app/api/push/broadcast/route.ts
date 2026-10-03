// src/app/api/push/broadcast/route.ts
export const runtime = 'nodejs';

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { messaging } from '../../../../lib/firebaseAdmin';

// web-push : import en require pour éviter les problèmes ESM/CJS avec Next.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

// ⚠️ Clés en dur TEMPORAIRES
const SUPABASE_URL =
  'https://rvswrzxdzfdtenxqtbci.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

// ── Clés VAPID ──

const VAPID_PUBLIC_KEY =
  'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'aDNoUdMC-E95kgkI4qI-HL76jvvybdFU7vBDxTgoW-0';

webpush.setVapidDetails(
  'mailto:hello@peps-foot.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

type Platform =
  | 'web'
  | 'twa'
  | 'ios'
  | 'android'
  | 'all';

type RecipientType =
  | 'all'
  | 'competition'
  | 'user';

type Payload = {
  title: string;
  body: string;
  url?: string;
  platform?: Platform;
  preferApp?: boolean;
  icon?: string;

  // Nouveau ciblage
  recipientType?: RecipientType;
  competitionId?: string;
  userId?: string;
};

const PLATFORM_PRIORITY: Platform[] = [
  'twa',
  'android',
  'web',
  'ios',
];

export async function POST(req: Request) {
  let payload: Payload;

  // ------------------------------------------------------------
  // 1. Lecture du JSON
  // ------------------------------------------------------------

  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'JSON invalide',
      }),
      { status: 400 }
    );
  }

  const {
    title,
    body,
    url = 'https://www.peps-foot.com/',
    platform = 'all',
    preferApp = true,
    icon,

    recipientType = 'all',
    competitionId,
    userId,
  } = payload;

  if (!title || !body) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'title/body requis',
      }),
      { status: 400 }
    );
  }

  // ------------------------------------------------------------
  // 2. Vérification du ciblage
  // ------------------------------------------------------------

  if (
    recipientType !== 'all' &&
    recipientType !== 'competition' &&
    recipientType !== 'user'
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'recipientType invalide',
      }),
      { status: 400 }
    );
  }

  if (
    recipientType === 'competition' &&
    !competitionId
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'competitionId requis pour un ciblage compétition',
      }),
      { status: 400 }
    );
  }

  if (
    recipientType === 'user' &&
    !userId
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'userId requis pour un ciblage utilisateur',
      }),
      { status: 400 }
    );
  }

  // ------------------------------------------------------------
  // 3. Déterminer les utilisateurs ciblés
  // ------------------------------------------------------------

  let targetUserIds: Set<string> | null = null;

  /*
   * null = pas de ciblage par utilisateur
   *        => comportement "Tous les utilisateurs"
   *
   * Set(...) = liste précise des user_id autorisés
   */

  if (recipientType === 'user') {
    targetUserIds = new Set([userId!]);
  }

  if (recipientType === 'competition') {
    // Vérifier la compétition
    const { data: competition, error: competitionError } =
      await supabase
        .from('competitions')
        .select('id, name, game_type, mode')
        .eq('id', competitionId!)
        .single();

    if (competitionError || !competition) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            competitionError?.message ||
            'Compétition introuvable',
        }),
        { status: 404 }
      );
    }

    // ----------------------------------------------------------
    // Membres de la compétition
    // ----------------------------------------------------------

    const {
      data: members,
      error: membersError,
    } = await supabase
      .from('competition_members')
      .select('user_id')
      .eq('competition_id', competitionId!);

    if (membersError) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: membersError.message,
        }),
        { status: 500 }
      );
    }

    const memberIds = new Set(
      (members || [])
        .map((row) => row.user_id as string)
        .filter(Boolean)
    );

    // ----------------------------------------------------------
    // GRID TOURNOI :
    // les personnes présentes dans grid_player_eligibility
    // sont considérées comme éliminées.
    // ----------------------------------------------------------

    const isGridTournament =
      competition.game_type === 'GRID' &&
      competition.mode === 'TOURNOI';

    if (isGridTournament) {
      const {
        data: eliminated,
        error: eliminatedError,
      } = await supabase
        .from('grid_player_eligibility')
        .select('user_id')
        .eq('competition_id', competitionId!);

      if (eliminatedError) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: eliminatedError.message,
          }),
          { status: 500 }
        );
      }

      const eliminatedIds = new Set(
        (eliminated || [])
          .map((row) => row.user_id as string)
          .filter(Boolean)
      );

      targetUserIds = new Set(
        [...memberIds].filter(
          (uid) => !eliminatedIds.has(uid)
        )
      );
    } else {
      // GRID CLASSIC / SUPPORTER / TIERCE
      // Tous les membres sont ciblables.
      targetUserIds = memberIds;
    }

    // ----------------------------------------------------------
    // Log utile pour l'admin
    // ----------------------------------------------------------

    console.log(
      `[PUSH] Competition "${competition.name}" ` +
        `(${competition.game_type} · ${competition.mode}) ` +
        `→ ${targetUserIds.size} utilisateurs ciblés`
    );
  }

  // ------------------------------------------------------------
  // 4. Récupération des tokens
  // ------------------------------------------------------------

  let q = supabase
    .from('push_tokens')
    .select(
      'token, user_id, platform'
    )
    .order(
      'last_seen_at',
      {
        ascending: false,
        nullsFirst: false,
      }
    );

  if (platform !== 'all') {
    q = q.eq('platform', platform);
  }

  const {
    data: tokenRows,
    error,
  } = await q;

  if (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        supabase_error: error.message,
      }),
      { status: 500 }
    );
  }

  // ------------------------------------------------------------
  // 5. Utilisateurs qui ont désactivé les broadcasts
  // ------------------------------------------------------------

  const {
    data: disallowed,
  } = await supabase
    .from('push_prefs')
    .select('user_id')
    .eq('allow_admin_broadcast', false);

  const blocked = new Set(
    (disallowed || []).map(
      (r) => r.user_id as string
    )
  );

  // ------------------------------------------------------------
  // 6. Construction de la liste
  // ------------------------------------------------------------

  const withUid = new Map<
    string,
    {
      token: string;
      platform: Platform;
    }[]
  >();

  const anonTokens: {
    token: string;
    platform: Platform;
  }[] = [];

  for (const r of tokenRows || []) {
    const uid =
      r.user_id as string | null;

    const plat =
      (r.platform as Platform) || 'web';

    // ----------------------------------------------------------
    // Si le token appartient à un utilisateur
    // ----------------------------------------------------------

    if (uid) {
      // Utilisateur qui a désactivé les broadcasts
      if (blocked.has(uid)) {
        continue;
      }

      // Ciblage précis
      if (
        targetUserIds !== null &&
        !targetUserIds.has(uid)
      ) {
        continue;
      }

      if (!withUid.has(uid)) {
        withUid.set(uid, []);
      }

      withUid.get(uid)!.push({
        token: r.token as string,
        platform: plat,
      });
    }

    // ----------------------------------------------------------
    // Token anonyme
    // ----------------------------------------------------------
    else {
      /*
       * Les tokens anonymes restent utilisables uniquement
       * pour le broadcast général.
       *
       * On ne peut évidemment pas les rattacher à une
       * compétition ou à un user_id précis.
       */
      if (targetUserIds === null) {
        anonTokens.push({
          token: r.token as string,
          platform: plat,
        });
      }
    }
  }

  // ------------------------------------------------------------
  // 7. Choix du meilleur token par utilisateur
  // ------------------------------------------------------------

  function pickForUser(
    rows: {
      token: string;
      platform: Platform;
    }[]
  ): {
    token: string;
    platform: Platform;
  }[] {
    if (
      platform === 'all' &&
      preferApp
    ) {
      for (const p of PLATFORM_PRIORITY) {
        const subset =
          rows.filter(
            (r) => r.platform === p
          );

        if (subset.length) {
          return subset;
        }
      }

      return [];
    }

    return rows;
  }

  const selected: {
    token: string;
    platform: Platform;
  }[] = [];

  for (const [, rows] of withUid) {
    selected.push(
      ...pickForUser(rows)
    );
  }

  selected.push(...anonTokens);

  // ------------------------------------------------------------
  // 8. Déduplication des tokens
  // ------------------------------------------------------------

  const seen = new Set<string>();

  const tokens = selected.filter(
    (r) => {
      if (seen.has(r.token)) {
        return false;
      }

      seen.add(r.token);

      return true;
    }
  );

  // Nombre d'utilisateurs effectivement ciblés
  const targetedUsers =
    withUid.size;

  if (!tokens.length) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'no tokens (filtered)',
        recipientType,
        targeted_users:
          targetedUsers,
        selected_tokens: 0,
      }),
      { status: 404 }
    );
  }

  // ------------------------------------------------------------
  // 9. Payload notification
  // ------------------------------------------------------------

  const notifPayload =
    JSON.stringify({
      notification: {
        title,
        body,
        icon:
          icon ||
          '/images/notifications/peps-notif-icon-192.png',
      },

      data: {
        url,
        tag: 'peps-broadcast',
      },
    });

  // ------------------------------------------------------------
  // 10. Envoi d'une notification
  // ------------------------------------------------------------

  const toDelete =
    new Set<string>();

  const sendOne = async (
    row: {
      token: string;
      platform: Platform;
    }
  ) => {
    const {
      token: t,
      platform: plat,
    } = row;

    // ----------------------------------------------------------
    // iOS → Web Push natif
    // ----------------------------------------------------------

    if (plat === 'ios') {
      try {
        const sub =
          JSON.parse(t) as {
            endpoint: string;
            keys: {
              p256dh: string;
              auth: string;
            };
          };

        await webpush.sendNotification(
          sub,
          notifPayload,
          {
            urgency: 'high',
            TTL: 10,
          }
        );

        return true;
      } catch (e: any) {
        const status =
          e?.statusCode ||
          e?.status;

        if (
          status === 404 ||
          status === 410
        ) {
          toDelete.add(t);
        }

        return false;
      }
    }

    // ----------------------------------------------------------
    // Android / Web / TWA → FCM
    // ----------------------------------------------------------

    try {
      await messaging.send({
        token: t,

        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '10',
          },

          data: {
            title,
            body,
            icon:
              icon ||
              '/images/notifications/peps-notif-icon-192.png',
            url,
            tag: 'peps-broadcast',
          },
        },
      });

      return true;
    } catch (e: any) {
      const msg =
        e?.errorInfo?.code ||
        e?.message ||
        '';

      if (
        String(msg).includes(
          'registration-token-not-registered'
        ) ||
        String(msg).includes(
          'invalid-argument'
        )
      ) {
        toDelete.add(t);
      }

      return false;
    }
  };

  // ------------------------------------------------------------
  // 11. Envoi par lots
  // ------------------------------------------------------------

  const BATCH = 50;

  let sent = 0;
  let failed = 0;

  for (
    let i = 0;
    i < tokens.length;
    i += BATCH
  ) {
    const batch =
      tokens.slice(
        i,
        i + BATCH
      );

    const results =
      await Promise.all(
        batch.map(sendOne)
      );

    sent += results.filter(
      Boolean
    ).length;

    failed += results.filter(
      (x) => !x
    ).length;
  }

  // ------------------------------------------------------------
  // 12. Suppression des tokens invalides
  // ------------------------------------------------------------

  if (toDelete.size) {
    await supabase
      .from('push_tokens')
      .delete()
      .in(
        'token',
        Array.from(toDelete)
      );
  }

  // ------------------------------------------------------------
  // 13. Résultat
  // ------------------------------------------------------------

  return Response.json({
    ok: true,

    recipientType,

    targeted_users:
      targetedUsers,

    selected_tokens:
      tokens.length,

    sent,

    failed,

    removed:
      toDelete.size,

    competition_id:
      competitionId || null,

    user_id:
      userId || null,
  });
}