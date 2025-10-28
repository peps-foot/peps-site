// pour gérer l'affichage des cases 1N2 quand un bonus est joué.
export type BonusPick = '1' | 'N' | '2';
export type OverlayEntry = { disabled: boolean; picks?: BonusPick[]; codes: string[] }; 
 
 export function computeOverlay(
    bonusDefs: Array<{ id: string; code: string }>,
    gridBonuses: Array<{ bonus_definition: string; match_id: string | number; parameters?: any }>
  ): { globalDisabled: boolean; byMatch: Record<string, OverlayEntry> } {
    // map id -> code
    const codeById: Record<string, string> = {};
    for (const d of bonusDefs ?? []) codeById[d.id] = d.code;

    const byMatch: Record<string, OverlayEntry> = {};
    let bielsaMatchId: string | undefined;
    let butsMatchId: string | undefined;

    const toPick = (v: any): BonusPick | undefined =>
      v === '1' || v === 'N' || v === '2' ? v : undefined;

    const toPicks = (arr: any): BonusPick[] | undefined => {
      if (!Array.isArray(arr)) return undefined;
      const out = arr.map(toPick).filter(Boolean) as BonusPick[];
      return out.length ? out : undefined;
    };

    for (const gb of gridBonuses ?? []) {
      const mid = String(gb.match_id);
      const code = codeById[gb.bonus_definition] || '';
      const params = gb?.parameters ?? {};

      if (!byMatch[mid]) byMatch[mid] = { disabled: false, codes: [] };
      byMatch[mid].disabled = true;            // un bonus posé => match désactivé
      byMatch[mid].codes.push(code);

      // — mapping des croix/picks par code —
      switch (code) {
        case 'KANTE': {
          const picks = toPicks(params.picks);
          if (picks) byMatch[mid].picks = picks; // 2 croix
          break;
        }
        case 'RIBERY': {
          // 3 croix sur match_win / 0 croix sur match_zero
          if (params.match_win && String(params.match_win) === mid) {
            byMatch[mid].picks = ['1', 'N', '2'];
          } else if (params.match_zero && String(params.match_zero) === mid) {
            byMatch[mid].picks = []; // disabled déjà true
          }
            
          const winId  = params.match_win  ? String(params.match_win)  : undefined;
          const zeroId = params.match_zero ? String(params.match_zero) : undefined;

            // 3 croix sur match_win
            if (winId) {
                if (!byMatch[winId]) byMatch[winId] = { disabled: false, codes: [] };
                byMatch[winId].disabled = true;
                byMatch[winId].codes.push('RIBERY');
                byMatch[winId].picks = ['1','N','2'];
            }

            // 0 croix sur match_zero
            if (zeroId) {
                if (!byMatch[zeroId]) byMatch[zeroId] = { disabled: false, codes: [] };
                byMatch[zeroId].disabled = true;
                byMatch[zeroId].codes.push('RIBERY');
                byMatch[zeroId].picks = []; // disabled déjà true
            }
          break;
        }
        
        case 'ZLATAN':
        case 'BIELSA':
        case 'BUTS':
        case 'ECART':
        case 'CLEAN SHEET':
        case 'CLEAN_SHEET':
        case 'BOOST_1':
        case 'BOOST_2':
        case 'BOOST_3': {
          const p = toPick(params.pick);
          if (p) byMatch[mid].picks = [p];     // 1 croix
          break;
        }
        default:
          // autres bonus sans pick exploitable : rien à faire (disabled déjà true)
          break;
      }

      if (code === 'BIELSA') bielsaMatchId = mid;
      if (code === 'BUTS')   butsMatchId   = mid;
    }

    // — règle spéciale BIELSA + BUTS —
    const hasBielsa = Boolean(bielsaMatchId);
    if (hasBielsa && butsMatchId && byMatch[butsMatchId]) {
      // sur le match BUTS, on ne montre pas de croix (icône seule)
      delete byMatch[butsMatchId].picks;
    }
    // (sur le match BIELSA, on garde la croix via son pick)
    // globalDisabled sera utilisé dans le JSX pour tout griser quand BIELSA est présent

    return { globalDisabled: hasBielsa, byMatch };
  }