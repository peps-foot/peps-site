export function isMatchNoLongerNS(match: any) {
  return String(match?.status ?? '').toUpperCase() !== 'NS' || !!match?.is_locked;
}

export function getBielsaState({
  matches,
  gridBonuses,
  competitionBonuses,
  bonusDefById,
  currentGridId,
}: {
  matches: any[];
  gridBonuses: any[];
  competitionBonuses: any[];
  bonusDefById: Record<string, { code: string; category_id?: string }>;
  currentGridId: string;
}) {
  const hasBielsaAlreadyInCompetition = competitionBonuses.some(
    gb => bonusDefById[gb.bonus_definition]?.code === 'BIELSA'
  );

  const hasBielsaOnCurrentGrid = gridBonuses.some(
    gb => bonusDefById[gb.bonus_definition]?.code === 'BIELSA'
  );

  const bielsaPlayedElsewhere =
    hasBielsaAlreadyInCompetition && !hasBielsaOnCurrentGrid;

  const hasStartedPickedMatch = matches.some(
    m => !!m.pick && isMatchNoLongerNS(m)
  );

  const hasBlockingBonus = gridBonuses.some(gb => {
    const code = bonusDefById[gb.bonus_definition]?.code;

    if (!code) return false;
    if (code === 'BUTS') return false;
    if (code === 'BIELSA') return false;

    const match = matches.find(m => String(m.id) === String(gb.match_id));

    return isMatchNoLongerNS(match);
  });

  const hasNonButsBonus = gridBonuses.some(gb => {
    const code = bonusDefById[gb.bonus_definition]?.code;

    return !!code && code !== 'BUTS' && code !== 'BIELSA';
  });

  const bielsaEntry = gridBonuses.find(
    gb => bonusDefById[gb.bonus_definition]?.code === 'BIELSA'
  );

  const bielsaMatch = matches.find(
    m => String(m.id) === String(bielsaEntry?.match_id)
  );

  const bielsaLocked =
    !!bielsaEntry && isMatchNoLongerNS(bielsaMatch);

  const shouldHideCard =
    bielsaPlayedElsewhere ||
    bielsaLocked ||
    (!hasBielsaOnCurrentGrid && (hasStartedPickedMatch || hasBlockingBonus));

  const canPlay =
    !hasBielsaAlreadyInCompetition &&
    !hasStartedPickedMatch &&
    !hasBlockingBonus &&
    !hasNonButsBonus;

  return {
    shouldHideCard,
    canPlay,
    canOpen: hasBielsaOnCurrentGrid ? !bielsaLocked : canPlay,
  };
}