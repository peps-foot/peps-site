import { NextRequest, NextResponse } from 'next/server';
import { createClient, User } from '@supabase/supabase-js';
import { getRecipients } from '../../../../../lib/admin/getRecipients';

const PEPS_ADMIN_EMAIL = 'admin@peps.foot';

type AudienceType = 'ALL' | 'COMPETITION' | 'USER';

type RequestBody = {
  audience: AudienceType;
  competitionId?: string;
  userId?: string;
};

export async function POST(request: NextRequest) {
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

    // Vérification réelle du compte connecté
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

    const body = (await request.json()) as RequestBody;

    const recipients = await getRecipients({
    supabaseAdmin,
    audience: body.audience,
    competitionId: body.competitionId,
    userId: body.userId,
    });

    return NextResponse.json({
    count: recipients.length,
    });
  } catch (error) {
    console.error('Erreur compteur destinataires :', error);

    return NextResponse.json(
      { error: 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}