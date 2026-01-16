export const ELIM_IMAGES: Record<string, string> = {
  shark: '/images/elimine/shark.png',
  totem: '/images/elimine/totem.png',
  terminator: '/images/elimine/terminator.png',
  spectateur: '/images/elimine/spectateur.png',
  default: '/images/elimine/default.png',
};

export function isTournamentCompetition(competition: any): boolean {
  return competition?.mode === 'TOURNOI';
}

function getEliminationVariantFromCompetition(competition: any): string {
  const name = (competition?.name ?? '').toLowerCase();

  if (name.includes('shark')) return 'shark';
  if (name.includes('totem')) return 'totem';
  if (name.includes('terminator')) return 'terminator';

  return 'default';
}

export function getGateImageSrc(params: {
  gateState: 'joueur' | 'elimine' | 'spectateur';
  competition?: any;
}): string {
  const { gateState, competition } = params;

  // Spectateur → image spectateur unique
  if (gateState === 'spectateur') {
    return ELIM_IMAGES.spectateur;
  }

  // Éliminé → image liée au tournoi
  if (gateState === 'elimine') {
    const variant = getEliminationVariantFromCompetition(competition);
    return ELIM_IMAGES[variant] ?? ELIM_IMAGES.default;
  }

  // Sécurité (normalement jamais affiché)
  return ELIM_IMAGES.default;
}