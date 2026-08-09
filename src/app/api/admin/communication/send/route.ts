import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getRecipients,
  AudienceType,
} from '../../../../../lib/admin/getRecipients';

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

    // Vérifier que c'est bien l'admin PEPS
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

    // Récupération des vrais destinataires
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

    let sentCount = 0;
    let failedCount = 0;

    const failedEmails: string[] = [];

    // Envoi individuel d'un mail
    async function sendOneEmail(email: string) {
      try {
        const response = await fetch(
          'https://api.brevo.com/v3/smtp/email',
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'api-key': apiKey!,
            },
            body: JSON.stringify({
              sender: {
                name: 'PEPS',
                email: 'hello@peps-foot.com',
              },
              to: [
                {
                  email,
                },
              ],
              subject,
              textContent: message,
            }),
          }
        );

        if (response.ok) {
          sentCount += 1;
          return;
        }

        const result = await response.json().catch(() => null);

        console.error(
          `Erreur Brevo pour ${email} :`,
          result
        );

        failedCount += 1;
        failedEmails.push(email);
      } catch (error) {
        console.error(
          `Erreur pendant l'envoi à ${email} :`,
          error
        );

        failedCount += 1;
        failedEmails.push(email);
      }
    }

    // Lots de 10 pour ne pas lancer 236 appels simultanément
    const BATCH_SIZE = 10;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map((recipient) =>
          sendOneEmail(recipient.email)
        )
      );
    }

    return NextResponse.json({
      success: true,
      totalCount: recipients.length,
      sentCount,
      failedCount,
      failedEmails,
    });
  } catch (error) {
    console.error('Erreur envoi Brevo :', error);

    return NextResponse.json(
      { error: 'Impossible d’envoyer les mails.' },
      { status: 500 }
    );
  }
}