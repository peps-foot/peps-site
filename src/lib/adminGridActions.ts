// Pour ajouter/supprimer des matchs/grilles/tickets via la zone admin

import  supabase  from './supabaseBrowser';

/** 1) Ajouter une grille à une compétition (sans DELETE) */
export async function addGridToCompetition(compId: string, gridId: string) {
  const { error: insErr } = await supabase
    .from('competition_grids')
    .insert({ competition_id: compId, grid_id: gridId })
    .select(); // force l'exécution
  if (insErr) throw new Error('addGridToCompetition: ' + insErr.message);

  // Crée les lignes manquantes pour les joueurs (insert-only, sans effacer)
  const { error: regenErr } = await supabase.rpc(
    'regenerate_grid_matches_for_competition',
    { p_compet_id: compId }
  );
  if (regenErr) throw new Error('regenerate_grid_matches_for_competition: ' + regenErr.message);
}

/** 2) Retirer un match d’une grille (clean ciblé via RPC) */
export async function removeMatchFromGrid(gridId: string, matchId: number | string) {
  const { error } = await supabase.rpc('admin_remove_match_from_grid', {
    p_grid_id: gridId,
    p_match_id_text: String(matchId), // 👈 envoie toujours une string
  });
  if (error) throw new Error('removeMatchFromGrid: ' + error.message);
}

/** 3) Retirer une grille d’une compétition (detach propre via RPC) */
export async function removeGridFromCompetition(compId: string, gridId: string) {
  const { error } = await supabase.rpc('admin_delete_grid_from_competition', {
    p_compet_id: compId,
    p_grid_id: gridId,
  });
  if (error) throw new Error('removeGridFromCompetition: ' + error.message);
}

/** 4) (Option) Supprimer la grille PARTOUT (si tu as un bouton “supprimer la grille”) */
export async function deleteGridEverywhere(gridId: string) {
  const { error } = await supabase.rpc('admin_delete_grid_everywhere', {
    p_grid_id: gridId,
  });
  if (error) throw new Error('deleteGridEverywhere: ' + error.message);
}

/** 5) Ajouter un ticket à une compétition */
export async function addTicketToCompetition(compId: string, ticketId: string) {
  const { error: insErr } = await supabase
    .from('competition_tickets')
    .insert({ competition_id: compId, ticket_id: ticketId })
    .select();

  if (insErr) throw new Error('addTicketToCompetition: ' + insErr.message);

  const { error: updErr } = await supabase
    .from('tierce_tickets')
    .update({ competition_id: compId })
    .eq('id', ticketId);

  if (updErr) throw new Error('addTicketToCompetition tierce_tickets.update: ' + updErr.message);
}

/** 6) Retirer un ticket d’une compétition (detach propre) */
export async function removeTicketFromCompetition(compId: string, ticketId: string) {
  const { error: delErr } = await supabase
    .from('competition_tickets')
    .delete()
    .eq('competition_id', compId)
    .eq('ticket_id', ticketId);

  if (delErr) throw new Error('removeTicketFromCompetition competition_tickets.delete: ' + delErr.message);

  const { error: updErr } = await supabase
    .from('tierce_tickets')
    .update({ competition_id: null })
    .eq('id', ticketId)
    .eq('competition_id', compId);

  if (updErr) throw new Error('removeTicketFromCompetition tierce_tickets.update: ' + updErr.message);
}

/** 7) Retirer un match d’un ticket */
export async function removeMatchFromTicket(ticketId: string, matchId: number | string) {
  const { error } = await supabase
    .from('tierce_ticket_matches')
    .delete()
    .eq('ticket_id', ticketId)
    .eq('match_id', String(matchId));

  if (error) throw new Error('removeMatchFromTicket: ' + error.message);
}

/** 8) Supprimer le ticket PARTOUT */
export async function deleteTicketEverywhere(ticketId: string) {
  const { error } = await supabase.rpc('admin_delete_ticket_everywhere', {
    p_ticket_id: ticketId,
  });

  if (error) throw new Error('deleteTicketEverywhere: ' + error.message);
}
