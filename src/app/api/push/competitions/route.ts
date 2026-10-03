// src/app/api/push/competitions/route.ts

export const runtime = 'nodejs';

import 'server-only';
import { createClient } from '@supabase/supabase-js';

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

export async function GET() {
  try {
    // 1. Toutes les compétitions
    const { data: competitions, error } =
      await supabase
        .from('competitions')
        .select(
          'id, name, game_type, mode'
        )
        .order('created_at', {
          ascending: false,
        });

    if (error) {
      return Response.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    // 2. Membres
    const { data: members, error: membersError } =
      await supabase
        .from('competition_members')
        .select(
          'competition_id, user_id'
        );

    if (membersError) {
      return Response.json(
        {
          ok: false,
          error: membersError.message,
        },
        { status: 500 }
      );
    }

    // 3. Joueurs éliminés GRID
    const { data: eliminated, error: eliminatedError } =
      await supabase
        .from('grid_player_eligibility')
        .select(
          'competition_id, user_id'
        );

    if (eliminatedError) {
      return Response.json(
        {
          ok: false,
          error: eliminatedError.message,
        },
        { status: 500 }
      );
    }

    // 4. Utilisateurs ayant un token
    const { data: pushTokens, error: pushError } =
      await supabase
        .from('push_tokens')
        .select('user_id');

    if (pushError) {
      return Response.json(
        {
          ok: false,
          error: pushError.message,
        },
        { status: 500 }
      );
    }

    const membersByCompetition =
      new Map<string, Set<string>>();

    for (const row of members || []) {
      if (!row.user_id) continue;

      if (
        !membersByCompetition.has(
          row.competition_id
        )
      ) {
        membersByCompetition.set(
          row.competition_id,
          new Set()
        );
      }

      membersByCompetition
        .get(row.competition_id)!
        .add(row.user_id);
    }

    const eliminatedByCompetition =
      new Map<string, Set<string>>();

    for (const row of eliminated || []) {
      if (!row.user_id) continue;

      if (
        !eliminatedByCompetition.has(
          row.competition_id
        )
      ) {
        eliminatedByCompetition.set(
          row.competition_id,
          new Set()
        );
      }

      eliminatedByCompetition
        .get(row.competition_id)!
        .add(row.user_id);
    }

    const usersWithPush =
      new Set<string>();

    for (const row of pushTokens || []) {
      if (row.user_id) {
        usersWithPush.add(row.user_id);
      }
    }

    const result = (competitions || []).map(
      (competition) => {
        const membersSet =
          membersByCompetition.get(
            competition.id
          ) || new Set<string>();

        const eliminatedSet =
          eliminatedByCompetition.get(
            competition.id
          ) || new Set<string>();

        const isTournamentGrid =
          competition.game_type === 'GRID' &&
          competition.mode === 'TOURNOI';

        const eligibleUsers = Array.from(
          membersSet
        ).filter((uid) => {
          if (!isTournamentGrid) {
            return true;
          }

          return !eliminatedSet.has(uid);
        });

        const pushUsers =
          eligibleUsers.filter((uid) =>
            usersWithPush.has(uid)
          );

        return {
          id: competition.id,
          name: competition.name,
          game_type: competition.game_type,
          mode: competition.mode,

          members_count:
            membersSet.size,

          eliminated_count:
            isTournamentGrid
              ? eliminatedSet.size
              : 0,

          eligible_count:
            eligibleUsers.length,

          push_count:
            pushUsers.length,
        };
      }
    );

    return Response.json({
      ok: true,
      competitions: result,
    });
  } catch (e: any) {
    return Response.json(
      {
        ok: false,
        error:
          e?.message ||
          String(e),
      },
      { status: 500 }
    );
  }
}