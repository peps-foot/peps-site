import { SupabaseClient, User } from '@supabase/supabase-js';

export type AudienceType = 'ALL' | 'COMPETITION' | 'USER';

type GetRecipientsParams = {
  supabaseAdmin: SupabaseClient;
  audience: AudienceType;
  competitionId?: string;
  userId?: string;
};

export type Recipient = {
  userId: string;
  email: string;
};

export async function getRecipients({
  supabaseAdmin,
  audience,
  competitionId,
  userId,
}: GetRecipientsParams): Promise<Recipient[]> {
  let userIds: string[] = [];

  // ── Tous les profils PEPS ──
  if (audience === 'ALL') {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .not('user_id', 'is', null);

    if (error) {
      console.error('Erreur profils :', error);
      throw new Error('Impossible de récupérer les profils.');
    }

    userIds = (profiles || [])
      .map((profile) => profile.user_id)
      .filter((id): id is string => Boolean(id));
  }

  // ── Membres d’une compétition ──
  else if (audience === 'COMPETITION') {
    if (!competitionId) {
      throw new Error('Compétition manquante.');
    }

    const { data: competition, error: competitionError } =
      await supabaseAdmin
        .from('competitions')
        .select('id')
        .eq('id', competitionId)
        .eq('kind', 'PUBLIC')
        .maybeSingle();

    if (competitionError || !competition) {
      throw new Error('Compétition publique introuvable.');
    }

    const { data: members, error } = await supabaseAdmin
      .from('competition_members')
      .select('user_id')
      .eq('competition_id', competitionId);

    if (error) {
      console.error('Erreur membres :', error);
      throw new Error('Impossible de récupérer les membres.');
    }

    userIds = (members || [])
      .map((member) => member.user_id)
      .filter((id): id is string => Boolean(id));
  }

  // ── Une personne précise ──
  else if (audience === 'USER') {
    if (!userId) {
      throw new Error('Utilisateur manquant.');
    }

    userIds = [userId];
  }

  else {
    throw new Error('Groupe de destinataires invalide.');
  }

  // Supprime les éventuels doublons
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return [];
  }

  /*
    Récupération des comptes Supabase Auth.

    La liste est paginée pour continuer à fonctionner
    lorsque PEPS dépassera 1 000 comptes.
  */
  const authUsers: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      console.error('Erreur comptes Auth :', error);
      throw new Error(
        'Impossible de récupérer les adresses e-mail.'
      );
    }

    authUsers.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  const wantedIds = new Set(uniqueUserIds);

  return authUsers
    .filter(
      (user) =>
        wantedIds.has(user.id) &&
        Boolean(user.email)
    )
    .map((user) => ({
      userId: user.id,
      email: user.email!,
    }));
}