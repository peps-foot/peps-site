// lib/competitionStatus.ts
"use client";
import supabase from "../lib/supabaseBrowser";

export type StatusColor = "blue" | "green" | "gray";
export type StatusItem = { label: string; color: StatusColor; isActiveRank: boolean };
export type CompetitionMode = "CLASSIC" | "TOURNOI";

function ordinalFr(n: number) { return n === 1 ? "1er" : `${n}e`; }

/** Source unique de vérité pour calculer le statut d’une compet pour un user donné */
export async function fetchCompetitionStatus(args: {
  competitionId: string;
  mode: CompetitionMode;
  userId: string;
}): Promise<StatusItem> {
  const { competitionId, mode, userId } = args;

  // 1) grid_ids
  const { data: grids } = await supabase
    .from("competition_grids")
    .select("grid_id")
    .eq("competition_id", competitionId);
  const gridIds = (grids ?? []).map(g => g.grid_id);

  // 2) matches liés + statuts
  let totalMatches = 0, nsCount = 0, allNs = false, allFt = false;
  if (gridIds.length > 0) {
    const { data: gmRows } = await supabase
      .from("grid_matches")
      .select("match_id")
      .in("grid_id", gridIds);
    const matchIds = Array.from(new Set((gmRows ?? []).map(r => r.match_id).filter(Boolean)));
    totalMatches = matchIds.length;

    if (totalMatches > 0) {
      const { count: notFtCount } = await supabase
        .from("matches").select("id", { head: true, count: "exact" })
        .in("id", matchIds).neq("status", "FT");
      allFt = (notFtCount ?? 0) === 0;

      const { count: ns } = await supabase
        .from("matches").select("id", { head: true, count: "exact" })
        .in("id", matchIds).eq("status", "NS");
      nsCount = ns ?? 0;
      allNs = nsCount === totalMatches;
    }
  }

  // 3) activité joueur
  let hasPick = false, hasBonus = false;
  if (gridIds.length > 0) {
    const { count: picksCount } = await supabase
      .from("grid_matches").select("id", { head: true, count: "exact" })
      .in("grid_id", gridIds).eq("user_id", userId).not("pick", "is", null);
    hasPick = (picksCount ?? 0) > 0;

    const { count: bonusCount } = await supabase
      .from("grid_bonus").select("id", { head: true, count: "exact" })
      .in("grid_id", gridIds).eq("user_id", userId);
    hasBonus = (bonusCount ?? 0) > 0;
  }
  const hasActivity = hasPick || hasBonus;

  // 4) Tous NS
  if (totalMatches > 0 && allNs) {
    return hasActivity
      ? { label: "A VENIR", color: "blue", isActiveRank: false }
      : { label: "JOUER", color: "green", isActiveRank: false };
  }

  // 5) Tous FT
  if (totalMatches > 0 && allFt) {
    if (mode === "CLASSIC") {
      if (!hasActivity) return { label: "VOIR", color: "gray", isActiveRank: false };
      const { data: lb } = await supabase.rpc("get_leaderboard_general", { p_competition_id: competitionId });
      if (!lb || !Array.isArray(lb) || lb.length === 0) return { label: "VOIR", color: "gray", isActiveRank: false };
      const me = lb.find((r: any) => (r.user_id ?? r.id) === userId);
      if (!me) return { label: "Non classé", color: "gray", isActiveRank: false };
      const total = lb.length;
      const myRank = Number(me.rank);
      return { label: `${ordinalFr(myRank)} sur ${total}`, color: "gray", isActiveRank: false };
    }
    return { label: "VOIR", color: "gray", isActiveRank: false };
  }

  // 6) En cours : CLASSIC
  if (mode === "CLASSIC") {
    if (!hasActivity) return { label: "JOUER", color: "green", isActiveRank: false };
    const { data: lb } = await supabase.rpc("get_leaderboard_general", { p_competition_id: competitionId });
    if (!lb || !Array.isArray(lb) || lb.length === 0) return { label: "VOIR", color: "gray", isActiveRank: false };
    const me = lb.find((r: any) => (r.user_id ?? r.id) === userId);
    if (!me) return { label: "Non classé", color: "gray", isActiveRank: false };
    const total = lb.length;
    const myRank = Number(me.rank);
    const isActiveRank = nsCount > 0 && hasActivity;
    return { label: `${ordinalFr(myRank)} sur ${total}`, color: isActiveRank ? "blue" : "gray", isActiveRank };
  }

  // 7) En cours : TOURNOI
  const { data: elig } = await supabase
    .from("grid_player_eligibility")
    .select("can_play")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .maybeSingle();
  const canPlay = elig ? elig.can_play === true : true;
  const inProgress = totalMatches > 0 && !allNs && !allFt;

  if (inProgress && !hasActivity) return { label: "VOIR", color: "gray", isActiveRank: false };
  if (!canPlay) return { label: "VOIR", color: "gray", isActiveRank: false };
  return hasActivity ? { label: "QUALIFIÉ", color: "blue", isActiveRank: false }
                     : { label: "JOUER", color: "green", isActiveRank: false };
}

/** Helper pour classer des compétitions en 3 listes selon le status calculé */
export async function groupCompetitionsForHome(
  comps: { id: string; mode: CompetitionMode }[],
  userId: string
) {
  const pairs = await Promise.all(
    comps.map(async c => [c, await fetchCompetitionStatus({ competitionId: c.id, mode: c.mode, userId })] as const)
  );
  const mine: typeof comps = [];
  const toJoin: typeof comps = [];
  const history: typeof comps = [];

  for (const [comp, st] of pairs) {
    if (st.color === "blue") mine.push(comp);
    else if (st.color === "green") toJoin.push(comp);
    else history.push(comp);
  }

  return { mine, toJoin, history, statuses: new Map(pairs.map(([c, s]) => [c.id, s])) };
}
