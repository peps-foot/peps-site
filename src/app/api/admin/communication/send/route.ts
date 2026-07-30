import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRecipients, AudienceType } from '../../../../../lib/admin/getRecipients';

const PEPS_ADMIN_EMAIL = 'admin@peps.foot';

type RequestBody = {
  subject: string;
  message: string;
  audience: AudienceType;
  competitionId?: string;
  userId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    const body = (await request.json()) as RequestBody;

    const subject = body.subject?.trim();
    const message = body.message?.trim();

    if (!subject || !message) {
    return NextResponse.json(
        { error: 'L’objet et le message sont obligatoires.' },
        { status: 400 }
    );
    }

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

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (
      authError ||
      user?.email?.toLowerCase() !== PEPS_ADMIN_EMAIL
    ) {
      return NextResponse.json(
        { error: 'Accès interdit.' },
        { status: 403 }
      );
    }

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'La clé API Brevo est absente.' },
        { status: 500 }
      );
    }

    const recipients = await getRecipients({
    supabaseAdmin,
    audience: body.audience,
    competitionId: body.competitionId,
    userId: body.userId,
    });

    if (recipients.length === 0) {
    return NextResponse.json(
        { error: 'Aucun destinataire trouvé.' },
        { status: 400 }
    );
    }

    const brevoResponse = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
        sender: {
            name: 'PEPS',
            email: 'hello@peps-foot.com',
        },
        subject,
        textContent: message,
        messageVersions: recipients.map((recipient) => ({
            to: [
            {
                email: recipient.email,
            },
            ],
        })),
        }),
      }
    );

    const result = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Erreur Brevo :', result);

      return NextResponse.json(
        {
          error:
            result?.message ||
            'Brevo a refusé l’envoi du mail.',
        },
        { status: brevoResponse.status }
      );
    }

    return NextResponse.json({
    success: true,
    sentCount: recipients.length,
    messageIds: result.messageIds,
    });
  } catch (error) {
    console.error('Erreur envoi Brevo :', error);

    return NextResponse.json(
      { error: 'Impossible d’envoyer le mail de test.' },
      { status: 500 }
    );
  }
}