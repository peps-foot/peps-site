import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = body.email?.trim();
    const username = body.username?.trim();

    if (!email || !username) {
      return NextResponse.json(
        { error: 'Email et pseudo obligatoires.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'La clé API Brevo est absente.' },
        { status: 500 }
      );
    }

    const subject = '🏆 Bienvenue sur PEPS !';

    const textContent = `Salut ${username} 👋

Ton compte est créé !

Tu peux maintenant représenter ton club ou défier d'autres joueurs.

📱 Les applications sont disponibles en bas de la page de connexion.

🎯 Les 3 façons de jouer

🟢 1N2 — Le mode classique

Fais tes pronos sur la Ligue 1 et joue bien tes bonus pour viser le haut du classement.
Objectif : s'amuser et profiter des matchs différemment ! ⚽

🔵 SUPPORTER — La Guerre des Clubs

Fais tes pronos sur ton club préféré et joue bien tes bonus pour l'aider dans la Guerre des Clubs.

🟠 TIERCE — La course des pronostiqueurs

Choisis 3 équipes à chaque journée de Ligue 1. Plus elles performent, mieux tu seras classé !

À bientôt sur PEPS 👊

Pronos Entre Potes & Supporters`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur PEPS</title>
</head>

<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:25px 8px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:700px; background-color:#ffffff; border-radius:12px; overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:25px 20px 12px;">
              <img
                src="https://www.peps-foot.com/images/default-avatar.png"
                alt="PEPS"
                width="90"
                style="display:block; width:90px; height:auto;"
              >
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td style="padding:8px 20px 20px; text-align:center;">
              <h1 style="margin:0; font-size:28px; color:#111827;">
                🏆 Bienvenue !
              </h1>
            </td>
          </tr>

          <!-- Introduction -->
          <tr>
            <td style="padding:0 20px 10px;">

              <p style="font-size:16px; line-height:1.6; margin:0 0 12px;">
                Salut <strong>${username}</strong> 👋
              </p>

              <p style="font-size:16px; line-height:1.6; text-align:justify; margin:0 0 12px;">
                Ton compte est créé !
              </p>

              <p style="font-size:16px; line-height:1.6; text-align:justify; margin:0 0 18px;">
              Tu peux maintenant représenter ton club ou défier d'autres joueurs.<br>
              <strong>Objectif : s'amuser et profiter des matchs différemment ! ⚽</strong>
              </p>

              <p style="font-size:15px; line-height:1.6; text-align:center; margin:0 0 25px; padding:12px; background-color:#f9fafb; border-radius:8px;">
                📱 <strong>Les applications sont disponibles en bas de la page de connexion.</strong>
              </p>

            </td>
          </tr>

          <!-- Les 3 modes -->
          <tr>
            <td style="padding:0 20px 30px;">

              <h2 style="font-size:21px; margin:0 0 20px; color:#111827;">
                🎯 Les 3 façons de jouer
              </h2>

              <!-- 1N2 -->
              <div style="border-left:5px solid #22c55e; padding:15px 15px; margin-bottom:16px; background-color:#f9fafb; border-radius:0 8px 8px 0;">
                <h3 style="margin:0 0 8px; font-size:17px; color:#166534;">
                  🟢 1N2 — Le mode classique
                </h3>

                <p style="margin:0; font-size:15px; line-height:1.6; text-align:justify;">
                  Fais tes pronos sur <strong>la Ligue 1</strong> et joue bien tes <strong>bonus</strong> pour viser le haut du classement.
                </p>
              </div>

              <!-- SUPPORTER -->
              <div style="border-left:5px solid #3b82f6; padding:15px 15px; margin-bottom:16px; background-color:#f9fafb; border-radius:0 8px 8px 0;">
                <h3 style="margin:0 0 8px; font-size:17px; color:#1d4ed8;">
                  🔵 SUPPORTER — La Guerre des Clubs
                </h3>

                <p style="margin:0; font-size:15px; line-height:1.6; text-align:justify;">
                  Fais tes pronos sur <strong>ton club préféré</strong> et joue bien tes <strong>bonus</strong> pour l'aider dans la <strong>Guerre des Clubs</strong>.
                </p>
              </div>

              <!-- TIERCE -->
              <div style="border-left:5px solid #f97316; padding:15px 15px; background-color:#f9fafb; border-radius:0 8px 8px 0;">
                <h3 style="margin:0 0 8px; font-size:17px; color:#c2410c;">
                  🟠 TIERCE — La course des pronostiqueurs
                </h3>

                <p style="margin:0; font-size:15px; line-height:1.6; text-align:justify;">
                  Choisis <strong>3 équipes à chaque journée de Ligue 1</strong>. Plus elles performent, <strong>mieux tu seras classé !</strong>
                </p>
              </div>

            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 20px 30px; text-align:center;">

              <p style="font-size:16px; line-height:1.6; margin:0 0 12px;">
                À bientôt sur PEPS 👊
              </p>

              <p style="font-size:14px; color:#6b7280; margin:0;">
                <strong>Pronos Entre Potes &amp; Supporters</strong>
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

    const response = await fetch(
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
          to: [
            {
              email,
            },
          ],
          subject,
          textContent,
          htmlContent,
        }),
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);

      console.error('Erreur Brevo :', result);

      return NextResponse.json(
        { error: 'Brevo n’a pas pu envoyer le mail.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('Erreur mail de bienvenue :', error);

    return NextResponse.json(
      { error: 'Impossible d’envoyer le mail de bienvenue.' },
      { status: 500 }
    );
  }
}