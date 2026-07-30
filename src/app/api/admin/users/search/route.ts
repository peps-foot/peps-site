import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PEPS_ADMIN_EMAIL = 'admin@peps.foot';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Utilisateur non connecté.' },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Vérifie à qui appartient réellement le jeton reçu
    const {
      data: { user: connectedUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (
      authError ||
      connectedUser?.email?.toLowerCase() !== PEPS_ADMIN_EMAIL
    ) {
      return NextResponse.json(
        { error: 'Accès interdit.' },
        { status: 403 }
      );
    }

    const search = request.nextUrl.searchParams.get('q')?.trim() || '';

    if (search.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Recherche les pseudos correspondants
    const { data: profiles, error: profilesError } =
      await supabaseAdmin
        .from('profiles')
        .select('user_id, username')
        .not('user_id', 'is', null)
        .not('username', 'is', null)
        .ilike('username', `%${search}%`)
        .order('username', { ascending: true })
        .limit(10);

    if (profilesError) {
      console.error(
        'Erreur recherche profils :',
        profilesError
      );

      return NextResponse.json(
        { error: 'Impossible de rechercher les utilisateurs.' },
        { status: 500 }
      );
    }

    // Récupère l'adresse e-mail liée à chaque profil
    const users = await Promise.all(
      (profiles || []).map(async (profile) => {
        if (!profile.user_id || !profile.username) {
          return null;
        }

        const {
          data: { user },
          error,
        } = await supabaseAdmin.auth.admin.getUserById(
          profile.user_id
        );

        if (error || !user?.email) {
          return null;
        }

        return {
          id: profile.user_id,
          username: profile.username,
          email: user.email,
        };
      })
    );

    return NextResponse.json({
      users: users.filter(Boolean),
    });
  } catch (error) {
    console.error(
      'Erreur route recherche utilisateurs :',
      error
    );

    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}