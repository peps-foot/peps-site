'use client';

import { useEffect, useState } from 'react';
import supabase from '../../../lib/supabaseBrowser';
import Image from 'next/image';

type TierceTicket = {
  id: string;
  title: string;
  description?: string | null;
};

type TierceView = | 'ticket' | 'matches' | 'totalPoints' | 'rankGeneral' | 'rankTicket' | 'info';

type TierceScreenProps = {
  competitionId: string;
  isPrivate?: boolean;
};

type TierceMatch = {
  id: string;
  date: string;

  home_team: string;
  away_team: string;

  short_name_home: string | null;
  short_name_away: string | null;

  team_home_id: number;
  team_away_id: number;

  score_home: number | null;
  score_away: number | null;

  status: string | null;

  c1_points: number | null;
  cn_points: number | null;
  c2_points: number | null;

  attendance: number | null;
  venue_id: number | null;
};

type AvailableTeam = {
  key: string;
  matchId: string;
  date: string;
  side: 'home' | 'away';
  teamId: number;
  teamName: string;
  shortName: string | null;
  opponentName: string;
  shortOpponentName: string | null;
  status: string | null;
  vPoints: number | null;
  nPoints: number | null;
  dPoints: number | null;
};

type SelectedTeam = {
   teamId: number;
   teamName: string;
   matchId: string;
   pointsOdds: number | null;
   pointsGoals: number | null;
   pointsStadium: number | null;
   pointsTotal: number | null;
 };

export default function TierceScreen({
  competitionId,
  isPrivate = false,
}: TierceScreenProps) {
  const [view, setView] = useState<TierceView>('ticket');

  const [tickets, setTickets] = useState<TierceTicket[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const currentTicket = tickets[currentIdx] ?? null;

  const [ticketMatches, setTicketMatches] = useState<TierceMatch[]>([]);

  // Pour récupérer l'user courant
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

  // Pour l'affichage du TICKET
  const [selectedTeam1Points, setSelectedTeam1Points] = useState<number | null>(null);
  const [selectedTeam2Points, setSelectedTeam2Points] = useState<number | null>(null);
  const [selectedTeam3Points, setSelectedTeam3Points] = useState<number | null>(null);

  const getTeamRowData = (
  selectedTeam: SelectedTeam | null,
  order: 1 | 2 | 3,
  allTeams: AvailableTeam[]
) => {
    if (!selectedTeam) {
      return {
        order,
        teamName: `Équipe ${order} non choisie`,
        triplet: '- / - / -',
        displayPoints: '-',
        pointsClass: 'text-black',
        matchStarted: false,
      };
    }

    const team = allTeams.find(
      (t) => t.teamId === selectedTeam.teamId && t.matchId === selectedTeam.matchId
    );

    //const leg = entryId
      //? undefined
      //: undefined;

    const match = ticketMatches.find((m) => m.id === selectedTeam.matchId);

    const v = team?.vPoints ?? '-';
    const n = team?.nPoints ?? '-';
    const d = team?.dPoints ?? '-';

    const legPoints =
      order === 1
        ? selectedTeam1Points
        : order === 2
        ? selectedTeam2Points
        : selectedTeam3Points;

    const coeff = order === 1 ? 1.1 : order === 2 ? 1.05 : 1;
    const weightedPoints =
      typeof legPoints === 'number' ? Math.round(legPoints * coeff * 10) / 10 : null;

    const isLive = match?.status && !['NS', 'FT', 'AET', 'PEN', 'AWD', 'WO', 'BT', 'P', 'ET', 'PST', 'CANC', 'ABD'].includes(match.status);
    const isFinished = match?.status && ['FT', 'AET', 'PEN', 'AWD', 'WO', 'BT', 'P', 'ET'].includes(match.status);
    const missingAttendance = isFinished && (match?.attendance == null || match?.venue_id == null);

    let pointsClass = 'text-black';
    if (isLive) pointsClass = 'text-orange-600';
    else if (missingAttendance) pointsClass = 'text-blue-600';

    return {
      order,
      teamName: selectedTeam.teamName,
      triplet: `${v} / ${n} / ${d}`,
      displayPoints: weightedPoints ?? '-',
      pointsClass,
      matchStarted: match?.status !== 'NS',
    };
  };

  const totalTicketPoints = (() => {
    const p1 = selectedTeam1Points ? selectedTeam1Points * 1.1 : 0;
    const p2 = selectedTeam2Points ? selectedTeam2Points * 1.05 : 0;
    const p3 = selectedTeam3Points ? selectedTeam3Points : 0;

    const total = p1 + p2 + p3;

    return Math.round(total * 10) / 10; // 1 décimale
  })();

  // Pour les classements
  const [lbLoading, setLbLoading] = useState(false);
  const [lbRows, setLbRows] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const fetchTierceLeaderboardByTicket = async () => {
    if (!competitionId || !currentTicket?.id) return;

    setLbLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('get_tierce_leaderboard_by_ticket', {
      p_competition_id: competitionId,
      p_ticket_id: currentTicket.id,
    });

    if (error) {
      console.error('Erreur leaderboard ticket:', error);
      setLbRows([]);
      setMyRank(null);
      setTotalPlayers(0);
      setLbLoading(false);
      return;
    }

    const rows = data || [];
    setLbRows(rows);
    setTotalPlayers(rows.length);

    const mine = rows.find((row: any) => row.user_id === user?.id);
    setMyRank(mine?.rank ?? null);

    setLbLoading(false);
  };

  const fetchTierceLeaderboardGeneral = async () => {
    if (!competitionId) return;

    setLbLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('get_tierce_leaderboard_general', {
      p_competition_id: competitionId,
    });

    if (error) {
      console.error('Erreur leaderboard général:', error);
      setLbRows([]);
      setMyRank(null);
      setTotalPlayers(0);
      setLbLoading(false);
      return;
    }

    const rows = data || [];
    setLbRows(rows);
    setTotalPlayers(rows.length);

    const mine = rows.find((row: any) => row.user_id === user?.id);
    setMyRank(mine?.rank ?? null);

    setLbLoading(false);
  };

  // Pour charger les vues
  useEffect(() => {
    if (view === 'rankTicket') {
      fetchTierceLeaderboardByTicket();
    }

    if (view === 'rankGeneral') {
      fetchTierceLeaderboardGeneral();
    }
  }, [view, competitionId, currentTicket?.id]);

  // Pour le choix des 3 équipes 
    // a - pour choisir les 3 équipes
  const [selectedTeam1, setSelectedTeam1] = useState<SelectedTeam | null>(null);
  const [selectedTeam2, setSelectedTeam2] = useState<SelectedTeam | null>(null);
  const [selectedTeam3, setSelectedTeam3] = useState<SelectedTeam | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);

    // b - pour retirer les équipes dont le match n'est plus NS
  const isMatchStarted = (matchId: string) => {
    const match = ticketMatches.find((m) => m.id === matchId);
    return match?.status !== 'NS';
  };

    // c - pour enregistrer le choix des équipes
  const getOrCreateEntry = async () => {
    if (!competitionId || !currentTicket?.id) return null;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    // 1) essayer de lire l'entrée existante
    const { data: existing, error: readError } = await supabase
      .from('tierce_entries')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('ticket_id', currentTicket.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (readError) return null;

    if (existing?.id) {
      setEntryId(existing.id);
      return existing.id;
    }

    // 2) sinon la créer
    const { data: created, error: createError } = await supabase
      .from('tierce_entries')
      .insert([
        {
          competition_id: competitionId,
          ticket_id: currentTicket.id,
          user_id: user.id,
        },
      ])
      .select('id')
      .single();

    if (createError || !created?.id) return null;

    setEntryId(created.id);
    return created.id;
  };

  // Pop-up choix des équipes
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<1 | 2 | 3 | null>(null);
  const openPicker = (slot: 1 | 2 | 3) => {
    setPickerSlot(slot);
    setIsPickerOpen(true);
  };
  const closePicker = () => {
    setIsPickerOpen(false);
    setPickerSlot(null);
  };
  const handlePickTeam = async (team: SelectedTeam) => {
      const resolvedEntryId = entryId ?? await getOrCreateEntry();
      if (!resolvedEntryId || !pickerSlot) return;

    // 1) upsert de la ligne du slot
    const { error } = await supabase
      .from('tierce_entry_legs')
      .upsert(
        [
          {
            entry_id: resolvedEntryId,
            team_id: team.teamId,
            match_id: team.matchId,
            pick_order: pickerSlot,
          },
        ],
        {
          onConflict: 'entry_id,pick_order',
        }
      );

    if (error) return;

    // 2) mise à jour locale
    if (pickerSlot === 1) {
      setSelectedTeam1(team);
      setSelectedTeam1Points(null);
    }
    if (pickerSlot === 2) {
      setSelectedTeam2(team);
      setSelectedTeam2Points(null);
    }
    if (pickerSlot === 3) {
      setSelectedTeam3(team);
      setSelectedTeam3Points(null);
    }

    closePicker();
  };
  const allTeams: AvailableTeam[] = ticketMatches.flatMap((match) => [
    {
      key: `${match.id}-home`,
      matchId: match.id,
      date: match.date,
      side: 'home' as const,
      teamId: match.team_home_id,
      teamName: match.home_team,
      shortName: match.short_name_home,
      opponentName: match.away_team,
      shortOpponentName: match.short_name_away,
      status: match.status,
      vPoints: match.c1_points,
      nPoints: match.cn_points,
      dPoints: match.c2_points,
    },
    {
      key: `${match.id}-away`,
      matchId: match.id,
      date: match.date,
      side: 'away' as const,
      teamId: match.team_away_id,
      teamName: match.away_team,
      shortName: match.short_name_away,
      opponentName: match.home_team,
      shortOpponentName: match.short_name_home,
      status: match.status,
      vPoints: match.c2_points !== null ? -match.c2_points : null,
      nPoints: match.cn_points !== null ? -match.cn_points : null,
      dPoints: match.c1_points !== null ? -match.c1_points : null,
    },
  ]);
  const availableTeams = allTeams.filter((team) => {
    // 1) on ne garde que les matchs à venir
    if (team.status !== 'NS') return false;

    // 2) on autorise l'équipe déjà présente dans le slot en cours de modification
    const currentSelection =
      pickerSlot === 1 ? selectedTeam1 :
      pickerSlot === 2 ? selectedTeam2 :
      pickerSlot === 3 ? selectedTeam3 :
      null;

    // 3) on retire les équipes déjà choisies ailleurs
    const selectedElsewhere = [selectedTeam1, selectedTeam2, selectedTeam3]
      .filter(Boolean)
      .filter((team) => team?.teamName !== currentSelection?.teamName)
      .map((team) => team!.teamName);

    return !selectedElsewhere.includes(team.teamName);
  });
  const [sortMode, setSortMode] = useState<'date' | 'fav' | 'outsider'>('date');
  const sortedTeams = [...availableTeams].sort((a, b) => {
    if (sortMode === 'date') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }

    if (sortMode === 'fav') {
      return (a.vPoints ?? 0) - (b.vPoints ?? 0);
    }

    if (sortMode === 'outsider') {
      return (b.vPoints ?? 0) - (a.vPoints ?? 0);
    }

    return 0;
  });

  // Mettre les valeurs V/N/D en couleur
  const getPointsColor = (value: number | null) => {
    if (value === null) return 'text-gray-400';
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-black';
  };

  // Pop-up VAR pour une équipe
  const [varOpen, setVarOpen] = useState(false);
  const [varSlot, setVarSlot] = useState<1 | 2 | 3 | null>(null);

  const openVar = (slot: 1 | 2 | 3) => {
    setVarSlot(slot);
    setVarOpen(true);
  };

  const closeVar = () => {
    setVarOpen(false);
    setVarSlot(null);
  };

  const getSelectedTeamBySlot = (slot: 1 | 2 | 3 | null) => {
    if (slot === 1) return selectedTeam1;
    if (slot === 2) return selectedTeam2;
    if (slot === 3) return selectedTeam3;
    return null;
  };

  const getCoeffBySlot = (slot: 1 | 2 | 3 | null) => {
    if (slot === 1) return 1.1;
    if (slot === 2) return 1.05;
    return 1;
  };

  const getWeightedTotal = (team: SelectedTeam | null, slot: 1 | 2 | 3 | null) => {
    if (!team?.pointsTotal) return team?.pointsTotal ?? null;
    const coeff = getCoeffBySlot(slot);
    return Math.round(team.pointsTotal * coeff * 10) / 10;
  };

  // Pour la zone MATCH
  const getMatchStatusDisplay = (s: string | null) => {
    if (!s || s === 'NS') return { label: 'À venir', color: 'text-gray-500' };

    if (['1H', 'HT', '2H'].includes(s)) {
      return { label: 'En cours', color: 'text-orange-600' };
    }

    if (['ET', 'BT', 'P', 'FT', 'AET', 'PEN'].includes(s)) {
      return { label: 'Terminé', color: 'text-gray-700' };
    }

    if (['SUSP', 'INT'].includes(s)) {
      return { label: 'Suspendu', color: 'text-orange-600' };
    }

    if (['CANC', 'ABD', 'AWD', 'WO', 'PST'].includes(s)) {
      return { label: 'Annulé', color: 'text-red-600' };
    }

    return { label: s, color: 'text-gray-400' };
  };

  const getPerfColorClass = (match: TierceMatch) => {
    const isLive =
      match.status &&
      !['NS', 'FT', 'AET', 'PEN', 'AWD', 'WO', 'BT', 'P', 'ET', 'PST', 'CANC', 'ABD'].includes(match.status);

    const isFinished =
      match.status &&
      ['FT', 'AET', 'PEN', 'AWD', 'WO', 'BT', 'P', 'ET'].includes(match.status);

    const missingAttendance =
      isFinished && (match.attendance == null || match.venue_id == null);

    if (isLive) return 'text-orange-600 border-orange-500';
    if (missingAttendance) return 'text-blue-600 border-blue-500';
    return 'text-black border-black';
  };

  const getHomeTriplet = (match: TierceMatch) => ({
    v: match.c1_points,
    n: match.cn_points,
    d: match.c2_points,
  });

  const getAwayTriplet = (match: TierceMatch) => ({
    v: match.c2_points !== null ? -match.c2_points : null,
    n: match.cn_points !== null ? -match.cn_points : null,
    d: match.c1_points !== null ? -match.c1_points : null,
  });

  const sortedTicketMatches = [...ticketMatches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Pour gérer les perfs de chaque équipe
  const [matchPerf, setMatchPerf] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadPerf = async () => {
      if (!ticketMatches || ticketMatches.length === 0) return;

      const results: Record<string, any> = {};

      for (const match of ticketMatches) {
        const { data, error } = await supabase.rpc('get_tierce_match_perf', {
          p_match_id: match.id,
        });

        if (!error && data && data[0]) {
          results[match.id] = data[0];
        }
      }

      setMatchPerf(results);
    };

    loadPerf();
  }, [ticketMatches]);

  // Pop-up VAR pour deux équipes
  const [matchVarOpen, setMatchVarOpen] = useState(false);
  const [selectedMatchVarId, setSelectedMatchVarId] = useState<string | null>(null);

  const openMatchVar = (matchId: string) => {
    setSelectedMatchVarId(matchId);
    setMatchVarOpen(true);
  };

  const closeMatchVar = () => {
    setSelectedMatchVarId(null);
    setMatchVarOpen(false);
  };

  const selectedMatchVar = selectedMatchVarId
    ? sortedTicketMatches.find((m) => m.id === selectedMatchVarId) ?? null
    : null;

  const selectedMatchVarPerf = selectedMatchVarId
    ? matchPerf[selectedMatchVarId] ?? null
    : null;

  // Navigation entre tickets
  const prevTicket = () => {setCurrentIdx((prev) => Math.max(prev - 1, 0));  };
  const nextTicket = () => {setCurrentIdx((prev) => tickets.length === 0 ? 0 : Math.min(prev + 1, tickets.length - 1));};

  // Ouverture accordéons zone info
  const [openInfoSection, setOpenInfoSection] = useState<1 | 2 | 3 | null>(1);

  // Chargement des tickets de la competition
  useEffect(() => {
    if (!competitionId) return;

    (async () => {
      const { data: links, error: linksError } = await supabase
        .from('competition_tickets')
        .select('ticket_id')
        .eq('competition_id', competitionId);

      if (linksError || !links || links.length === 0) {
        setTickets([]);
        setCurrentIdx(0);
        return;
      }

      const ticketIds = links.map((row) => row.ticket_id);

      const { data: ticketRows, error: ticketsError } = await supabase
        .from('tierce_tickets')
        .select('id, title, description')
        .in('id', ticketIds)
        .order('created_at', { ascending: true });

      if (ticketsError || !ticketRows) {
        setTickets([]);
        setCurrentIdx(0);
        return;
      }

      setTickets(ticketRows);
      setCurrentIdx(0);
    })();
  }, [competitionId]);

  // Chargement des matchs du ticket courant
  useEffect(() => {
    if (!currentTicket?.id) {
      setTicketMatches([]);
      return;
    }

    (async () => {
      const { data: links, error: linksError } = await supabase
        .from('tierce_ticket_matches')
        .select('match_id')
        .eq('ticket_id', currentTicket.id);

      if (linksError || !links || links.length === 0) {
        setTicketMatches([]);
        return;
      }

      const matchIds = links.map((row) => row.match_id);

      const { data: matchRows, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          home_team,
          away_team,
          short_name_home,
          short_name_away,
          team_home_id,
          team_away_id,
          score_home,
          score_away,
          status,
          c1_points,
          cn_points,
          c2_points,
          attendance,
          venue_id
        `)
        .in('id', matchIds);

      if (matchesError || !matchRows) {
        setTicketMatches([]);
        return;
      }

      setTicketMatches(matchRows);
    })();
  }, [currentTicket?.id]);

  // Chargement du ticket joueur
  useEffect(() => {
    if (!competitionId || !currentTicket?.id) {
      setEntryId(null);
      setSelectedTeam1(null);
      setSelectedTeam2(null);
      setSelectedTeam3(null);
      setSelectedTeam1Points(null);
      setSelectedTeam2Points(null);
      setSelectedTeam3Points(null);
      return;
    }

    (async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setEntryId(null);
        setSelectedTeam1(null);
        setSelectedTeam2(null);
        setSelectedTeam3(null);
        setSelectedTeam1Points(null);
        setSelectedTeam2Points(null);
        setSelectedTeam3Points(null);
        return;
      }

      const { data: entry, error: entryError } = await supabase
        .from('tierce_entries')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('ticket_id', currentTicket.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (entryError || !entry?.id) {
        setEntryId(null);
        setSelectedTeam1(null);
        setSelectedTeam2(null);
        setSelectedTeam3(null);
        setSelectedTeam1Points(null);
        setSelectedTeam2Points(null);
        setSelectedTeam3Points(null);
        return;
      }

      setEntryId(entry.id);

      const { data: legs, error: legsError } = await supabase
        .from('tierce_entry_legs')
        .select('team_id, match_id, pick_order, points_odds, points_goals, points_stadium, points_total')
        .eq('entry_id', entry.id);

      if (legsError || !legs) {
        setSelectedTeam1(null);
        setSelectedTeam2(null);
        setSelectedTeam3(null);
        setSelectedTeam1Points(null);
        setSelectedTeam2Points(null);
        setSelectedTeam3Points(null);
        return;
      }

      const mapTeamData = (leg: {
        team_id: number;
        match_id: string;
        pick_order: number;
        points_odds: number | null;
        points_goals: number | null;
        points_stadium: number | null;
        points_total: number | null;
      }) => {
        const found = allTeams.find(
          (team) => team.teamId === leg.team_id && team.matchId === leg.match_id
        );

        return found
          ? {
              teamId: found.teamId,
              teamName: found.teamName,
              matchId: found.matchId,
              pointsOdds: leg.points_odds,
              pointsGoals: leg.points_goals,
              pointsStadium: leg.points_stadium,
              pointsTotal: leg.points_total,
            }
          : null;
      };

      const leg1 = legs.find((l) => l.pick_order === 1);
      const leg2 = legs.find((l) => l.pick_order === 2);
      const leg3 = legs.find((l) => l.pick_order === 3);

      //const mapped1 = leg1 ? mapTeamData(leg1) : null;
      //const mapped2 = leg2 ? mapTeamData(leg2) : null;
      //const mapped3 = leg3 ? mapTeamData(leg3) : null;

      setSelectedTeam1(leg1 ? mapTeamData(leg1) : null);
      setSelectedTeam2(leg2 ? mapTeamData(leg2) : null);
      setSelectedTeam3(leg3 ? mapTeamData(leg3) : null);

      setSelectedTeam1Points(leg1?.points_total ?? null);
      setSelectedTeam2Points(leg2?.points_total ?? null);
      setSelectedTeam3Points(leg3?.points_total ?? null);
    })();
  }, [competitionId, currentTicket?.id, allTeams]);

  return (
    <div className="w-full mt-4">
      {/* ============================== */}
      {/* 🔹 LIGNE 1 : NAVIGATION + ICÔNES */}
      {/* ============================== */}
      <section className="w-full mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* A) NAVIGATION TICKETS */}
          <div className="border rounded-lg p-4 flex items-center justify-center gap-4">
            <button
              onClick={prevTicket}
              disabled={tickets.length === 0 || currentIdx === 0}
              className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Ticket précédent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-2xl font-semibold text-center">
              {currentTicket?.title || 'Chargement...'}
            </span>

            <button
              onClick={nextTicket}
              disabled={tickets.length === 0 || currentIdx === tickets.length - 1}
              className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Ticket suivant"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* B) BOUTONS DE VUES */}
          <div className="border rounded-lg p-4 flex items-center justify-center gap-4 flex-wrap">
            {/* 1) TICKET */}
            <button
              onClick={() => setView('ticket')}
              aria-pressed={view === 'ticket'}
              className={`w-12 h-12 rounded-full border border-black bg-white p-[3px] flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none ${
                view === 'ticket' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              title="Voir mon ticket"
            >
              Ticket
            </button>

            {/* 2) MATCHS */}
            <button
              onClick={() => setView('matches')}
              aria-pressed={view === 'matches'}
              className={`w-12 h-12 rounded-full border border-black bg-white p-[3px] flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none ${
                view === 'matches' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              title="Voir les matchs"
            >
              M
            </button>

            {/* 3) TOTAL POINTS */}
            <div
              className="w-12 h-12 rounded-full border border-black bg-white flex items-center justify-center font-semibold"
              title="Points du ticket"
            >
              {totalTicketPoints ?? '-'}
            </div>

            {/* 4) CLASSEMENT GÉNÉRAL */}
            <button
              onClick={() => setView('rankGeneral')}
              aria-pressed={view === 'rankGeneral'}
              className={`w-12 h-12 rounded-full border border-black bg-white p-[3px] flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none ${
                view === 'rankGeneral' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              title="Classement général"
            >
              G
            </button>

            {/* 5) CLASSEMENT TICKET */}
            <button
              onClick={() => setView('rankTicket')}
              aria-pressed={view === 'rankTicket'}
              className={`w-12 h-12 rounded-full border border-black bg-white p-[3px] flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none ${
                view === 'rankTicket' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              title="Classement du ticket"
            >
              C
            </button>

            {/* 6) INFOS */}
            <button
              onClick={() => setView('info')}
              aria-pressed={view === 'info'}
              className={`w-12 h-12 rounded-full border border-black bg-white p-[3px] flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none ${
                view === 'info' ? 'ring-2 ring-orange-500 bg-orange-50' : ''
              }`}
              title="Infos compétition"
            >
              Règles
            </button>
          </div>

        </div>
      </section>

      {/* ============================== */}
      {/* 🔹 LIGNE 2 : CONTENU SELON LA VUE */}
      {/* ============================== */}
      <section className="w-full">

        {/* -------------------------------- */}
        {/* VUES À 2 COLONNES : ticket / matches */}
        {/* -------------------------------- */}
        {(view === 'ticket' || view === 'matches') && (
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-start">

            {/* COLONNE GAUCHE */}
            <div>
            {view === 'ticket' && (
              <div className="border rounded-lg p-4 overflow-x-auto">
                <h2 className="text-center font-semibold text-lg mb-4">
                  MON TICKET
                </h2>

                <div className="w-full">
                  <div className="grid grid-cols-[8%_30%_28%_20%_14%] border-b font-semibold text-sm items-center">
                    <div className="p-2 text-center">#</div>
                    <div className="p-2">Équipe</div>
                    <div className="p-2 text-center">V/N/D</div>
                    <div className="p-2 text-center">PTS</div>
                    <div className="p-2 text-center">VAR</div>
                  </div>

                  {[
                    getTeamRowData(selectedTeam1, 1, allTeams),
                    getTeamRowData(selectedTeam2, 2, allTeams),
                    getTeamRowData(selectedTeam3, 3, allTeams),
                  ].map((row) => (
                    <div
                      key={row.order}
                      className="grid grid-cols-[8%_30%_28%_20%_14%] border-b text-sm items-center"
                    >
                      <div className="p-2 text-center">{row.order}</div>
                      <div className="p-2">{row.teamName}</div>
                      <div className="p-2 text-center">{row.triplet}</div>
                      <div className={`p-2 text-center font-semibold ${row.pointsClass}`}>
                        {row.displayPoints}
                      </div>
                      <div className="p-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => openVar(row.order as 1 | 2 | 3)}
                          disabled={row.teamName.includes('non choisie')}
                          className="relative w-10 h-10 shrink-0 rounded-full border border-black bg-white overflow-hidden disabled:opacity-40"
                          title="Voir le détail"
                        >
                          <Image
                            src="/images/info.png"
                            alt="VAR"
                            fill
                            className="object-cover rounded-full"
                          />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
                      <span>Match en cours</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                      <span>Match terminé, affluence manquante</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-black inline-block"></span>
                      <span>Points finaux</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'matches' && (
              <div className="border rounded-lg p-2 md:p-4">
                <h2 className="text-center font-semibold text-lg mb-4">
                  MATCHS DU TICKET
                </h2>

                {sortedTicketMatches.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 italic">À venir</p>
                ) : (
                  <div className="space-y-3">
                    {sortedTicketMatches.map((match) => {
                      const status = getMatchStatusDisplay(match.status);
                      const homeTriplet = getHomeTriplet(match);
                      const awayTriplet = getAwayTriplet(match);
                      const perfClass = getPerfColorClass(match);
                      const perf = matchPerf[match.id];

                      return (
                        <div key={match.id} className="border rounded-lg px-2.5 py-2">
                          <div className="grid grid-cols-[14%_25%_10%_10%_25%_11%] gap-1 items-center">
                            {/* Colonne 1 - Date / Heure / Status */}
                            <div className="text-left pl-1 leading-tight text-[10px] md:text-sm">
                              <div className="font-medium">
                                {new Date(match.date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </div>
                              <div>
                                {new Date(match.date).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div className={`mt-0.5 ${status.color}`}>
                                {status.label}
                              </div>
                            </div>

                            {/* Colonne 2 - Home */}
                            <div className="text-center leading-tight min-w-0">
                              <div className="font-semibold tracking-tight text-[15px] md:text-[18px] truncate">
                                {match.short_name_home || match.home_team}
                              </div>
                              <div className="text-[11px] md:text-sm text-gray-600 truncate">
                                {homeTriplet.v ?? '-'} | {homeTriplet.n ?? '-'} | {homeTriplet.d ?? '-'}
                              </div>
                            </div>

                            {/* Colonne 3 - Score + perf home */}
                            <div className="text-center leading-tight">
                              <div className="text-[14px] md:text-[18px] font-semibold leading-none">
                                {match.score_home ?? '-'}
                              </div>
                              <div className={`mt-0.5 inline-flex items-center justify-center min-w-[34px] md:min-w-[40px] h-6 md:h-7 rounded-full border text-[10px] md:text-sm font-semibold px-1.5 md:px-2 leading-none ${perfClass}`}>
                                {perf ? perf.home_total : '-'}
                              </div>
                            </div>

                            {/* Colonne 4 - Score + perf away */}
                            <div className="text-center leading-tight">
                              <div className="text-[14px] md:text-[18px] font-semibold leading-none">
                                {match.score_away ?? '-'}
                              </div>
                              <div className={`mt-0.5 inline-flex items-center justify-center min-w-[34px] md:min-w-[40px] h-6 md:h-7 rounded-full border text-[10px] md:text-sm font-semibold px-1.5 md:px-2 leading-none ${perfClass}`}>
                                {perf ? perf.away_total : '-'}
                              </div>
                            </div>

                            {/* Colonne 5 - Away */}
                            <div className="text-center leading-tight min-w-0">
                              <div className="font-semibold tracking-tight text-[15px] md:text-[18px] truncate">
                                {match.short_name_away || match.away_team}
                              </div>
                              <div className="text-[11px] md:text-sm text-gray-600 truncate">
                                {awayTriplet.v ?? '-'} | {awayTriplet.n ?? '-'} | {awayTriplet.d ?? '-'}
                              </div>
                            </div>

                            {/* Colonne 6 - VAR */}
                            <div className="flex justify-center items-center">
                              <button
                                type="button"
                                onClick={() => openMatchVar(match.id)}
                                className="w-10 h-10 rounded-full border border-black bg-white flex items-center justify-center overflow-hidden shrink-0"
                              >
                                <Image
                                  src="/images/info.png"
                                  alt="VAR"
                                  width={40}
                                  height={40}
                                  className="rounded-full object-cover"
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* COLONNE DROITE */}
              <div className="border rounded-lg p-4 mb-4 md:mb-0">
                <h2 className="text-center font-semibold text-lg mb-4">
                  CHOIX DES ÉQUIPES
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                    <div className="font-medium">Sélectionne l'équipe 1, gain +10%</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedTeam1 || !isMatchStarted(selectedTeam1.matchId)) {
                          openPicker(1);
                        }
                      }}
                      disabled={selectedTeam1 ? isMatchStarted(selectedTeam1.matchId) : false}
                      className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {selectedTeam1
                        ? isMatchStarted(selectedTeam1.matchId)
                          ? 'EN JEU'
                          : 'Modifier'
                        : 'Choisir'}
                    </button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                    <div className="font-medium">Sélectionne l'équipe 2, gain +5%</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedTeam2 || !isMatchStarted(selectedTeam2.matchId)) {
                          openPicker(2);
                        }
                      }}
                      disabled={selectedTeam2 ? isMatchStarted(selectedTeam2.matchId) : false}
                      className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {selectedTeam2
                        ? isMatchStarted(selectedTeam2.matchId)
                          ? 'EN JEU'
                          : 'Modifier'
                        : 'Choisir'}
                    </button>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                    <div className="font-medium">Sélectionne l'équipe 3</div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedTeam3 || !isMatchStarted(selectedTeam3.matchId)) {
                          openPicker(3);
                        }
                      }}
                      disabled={selectedTeam3 ? isMatchStarted(selectedTeam3.matchId) : false}
                      className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      {selectedTeam3
                        ? isMatchStarted(selectedTeam3.matchId)
                          ? 'EN JEU'
                          : 'Modifier'
                        : 'Choisir'}
                    </button>
                  </div>
                </div>
              </div>

          </div>
        )}

        {/* -------------------------------- */}
        {/* VUE PLEINE LARGEUR : classement général */}
        {/* -------------------------------- */}
        {view === 'rankGeneral' && (
          <div className="border rounded-lg p-4">
            {lbLoading && (
              <p className="text-center text-sm text-gray-500 my-4">Chargement…</p>
            )}

            <h2 className="text-center text-lg font-semibold text-gray-800 mb-3">
              Classement général
            </h2>

            {!lbLoading && myRank !== null && (
              <div className="text-center text-base font-medium text-gray-800 my-6">
                Tu es <strong>{myRank}</strong>
                <span className="ml-1 align-super">{myRank === 1 ? 'er' : 'e'}</span>
                {' '}sur <strong>{totalPlayers}</strong> joueur{totalPlayers > 1 ? 's' : ''}
              </div>
            )}

            {!lbLoading && lbRows.length > 0 && (
              <div className="max-w-2xl mx-auto">
                <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Pseudo</th>
                      <th className="text-left px-4 py-3">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbRows.map((row: any) => {
                      const me = row.user_id === currentUserId;
                      return (
                        <tr
                          key={row.user_id}
                          className={`border-t transition ${me ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-2">{row.rank}</td>
                          <td className="px-4 py-2">{row.username}</td>
                          <td className="px-4 py-2">{row.total_points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!lbLoading && lbRows.length === 0 && (
              <p className="text-center text-sm text-gray-500 my-4">
                Aucun participant pour cette compétition.
              </p>
            )}
          </div>
        )}

        {/* -------------------------------- */}
        {/* VUE PLEINE LARGEUR : classement ticket */}
        {/* -------------------------------- */}
        {view === 'rankTicket' && (
          <div className="border rounded-lg p-4">
            {lbLoading && (
              <p className="text-center text-sm text-gray-500 my-4">Chargement…</p>
            )}

            <h2 className="text-center text-lg font-semibold text-gray-800 mb-3">
              Classement du ticket
            </h2>

            {!lbLoading && myRank !== null && (
              <div className="text-center text-base font-medium text-gray-800 my-6">
                Tu es <strong>{myRank}</strong>
                <span className="ml-1 align-super">{myRank === 1 ? 'er' : 'e'}</span>
                {' '}sur <strong>{totalPlayers}</strong> joueur{totalPlayers > 1 ? 's' : ''}
              </div>
            )}

            {!lbLoading && lbRows.length > 0 && (
              <div className="max-w-2xl mx-auto">
                <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                    <tr>
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Pseudo</th>
                      <th className="text-left px-4 py-3">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbRows.map((row: any) => {
                      const me = row.user_id === currentUserId;
                      return (
                        <tr
                          key={row.user_id}
                          className={`border-t transition ${me ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-2">{row.rank}</td>
                          <td className="px-4 py-2">{row.username}</td>
                          <td className="px-4 py-2">{row.total_points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!lbLoading && lbRows.length === 0 && (
              <p className="text-center text-sm text-gray-500 my-4">
                Aucun participant pour ce ticket.
              </p>
            )}
          </div>
        )}

        {/* -------------------------------- */}
        {/* VUE PLEINE LARGEUR : infos */}
        {/* -------------------------------- */}
        {view === 'info' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-center text-lg font-semibold">
              Règles du jeu
            </h2>

            {/* ACCORDION 1 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenInfoSection(openInfoSection === 1 ? null : 1)}
                className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold bg-white hover:bg-gray-50"
              >
                <span>🎯 Le but du jeu</span>
                <span>{openInfoSection === 1 ? '−' : '+'}</span>
              </button>

              {openInfoSection === 1 && (
                <div className="px-4 pb-4 text-sm text-gray-700 space-y-2">
                  <p>
                    Lors d&apos;une journée de Ligue 1, sélectionne les <strong>3 équipes</strong> qui vont le plus performer selon toi.
                  </p>
                  <p>
                    La performance d&apos;une équipe dépend de 3 critères :
                    <br />• sa <strong>cote de résultat</strong>
                    <br />• son <strong>écart de buts</strong> lié au score
                    <br />• l&apos;<strong>affluence du stade</strong>
                  </p>
                  <p>
                    Tu dois aussi <strong>classer tes équipes de 1 à 3</strong> pour gagner plus de points :
                    <br />🥇 +10% | 🥈 +5% | 🥉 score normal
                  </p>
                </div>
              )}
            </div>

            {/* ACCORDION 2 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenInfoSection(openInfoSection === 2 ? null : 2)}
                className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold bg-white hover:bg-gray-50"
              >
                <span>📊 Calcul d&apos;une performance</span>
                <span>{openInfoSection === 2 ? '−' : '+'}</span>
              </button>

              {openInfoSection === 2 && (
                <div className="px-4 pb-4 text-sm text-gray-700 space-y-3">
                  <p>
                    La performance d&apos;une équipe est calculée avec la formule :
                  </p>

                  <div className="max-w-xs mx-auto border rounded-lg py-3 px-4 text-center font-semibold text-base">
                    45 + C + E + S
                  </div>

                  <p>
                    • <strong>C (Cote)</strong> : valeur visible dans le triplet <strong>Victoire / Nul / Défaite</strong>
                    <br />• <strong>E (Écart)</strong> : différence de buts × 5
                    <br />• <strong>S (Supporters)</strong> : taux de remplissage du stade divisé par 10
                  </p>
                  <p>
                    👉 Les exemples ci-dessous permettent de mieux comprendre.
                  </p>
                </div>
              )}
            </div>

            {/* ACCORDION 3 */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenInfoSection(openInfoSection === 3 ? null : 3)}
                className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold bg-white hover:bg-gray-50"
              >
                <span>⚽ Exemples</span>
                <span>{openInfoSection === 3 ? '−' : '+'}</span>
              </button>

              {openInfoSection === 3 && (
                <div className="px-4 pb-4 text-sm text-gray-700 space-y-3">
                  <p>
                    On calcule ici la <strong>performance de l'équipe de France</strong> avec le triplet :
                    <br />
                    <span className="font-semibold">Victoire : 13 | Nul : -6 | Défaite : -25</span>
                    <br />
                    Stade rempli à <strong>95%</strong> → S = 9.5
                  </p>

                  <div className="space-y-3">
                    <p>
                      <strong>1.</strong> La France gagne <strong>3-0</strong>
                      <br />
                      C = 13 | E = 15 | S = 9.5
                      <br />
                      👉 <strong>45 + 13 + 15 + 9.5 = 82.5</strong>
                    </p>

                    <p>
                      <strong>2.</strong> La France fait <strong>1-1</strong>
                      <br />
                      C = -6 | E = 0 | S = 9.5
                      <br />
                      👉 <strong>45 - 6 + 0 + 9.5 = 48.5</strong>
                    </p>

                    <p>
                      <strong>3.</strong> La France perd <strong>0-1</strong>
                      <br />
                      C = -25 | E = -10 | S = 9.5
                      <br />
                      👉 <strong>45 - 25 - 5 + 9.5 = 24.5</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ============================== */}
      {/* 🔹 DESCRIPTION DU TICKET */}
      {/* ============================== */}
      {Boolean(currentTicket?.description?.trim()) && (
        <section className="w-full mt-4">
          <div className="border rounded-lg p-4">
            <p className="text-center whitespace-pre-line">
              {currentTicket.description}
            </p>
          </div>
        </section>
      )}

      {/* ============================== */}
      {/* 🔹 POP-UP SÉLECTION ÉQUIPE */}
      {/* ============================== */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-[96vw] max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="relative p-4">
              <h3 className="text-lg font-semibold text-center">
                Choisir l&apos;équipe {pickerSlot}
              </h3>
              <button
                type="button"
                onClick={closePicker}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 border rounded hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>

            <div className="flex justify-center gap-2 mb-3">
              <button
                onClick={() => setSortMode('date')}
                className={`px-3 py-1 text-xs border rounded ${
                  sortMode === 'date' ? 'bg-gray-200' : ''
                }`}
              >
                Date
              </button>

              <button
                onClick={() => setSortMode('fav')}
                className={`px-3 py-1 text-xs border rounded ${
                  sortMode === 'fav' ? 'bg-gray-200' : ''
                }`}
              >
                Favoris
              </button>

              <button
                onClick={() => setSortMode('outsider')}
                className={`px-3 py-1 text-xs border rounded ${
                  sortMode === 'outsider' ? 'bg-gray-200' : ''
                }`}
              >
                Outsiders
              </button>
            </div>

          <div className="p-4 overflow-auto max-h-[65vh] space-y-2">
            <div className="w-full border rounded px-3 py-2 bg-gray-50">
              <div className="grid grid-cols-[33%_33%_33%] items-center gap-2 text-xs font-semibold text-gray-500">
                <div className="text-left">Équipe</div>
                <div className="text-left">VS</div>
                <div className="text-left">V | N | D</div>
              </div>
            </div>

            {availableTeams.length === 0 ? (
              <p className="text-gray-600">Aucune équipe disponible.</p>
            ) : (
              sortedTeams.map((team) => (
                <button
                  key={team.key}
                  type="button"
                  onClick={() =>
                    handlePickTeam({
                      teamId: team.teamId,
                      teamName: team.teamName,
                      matchId: team.matchId,
                      pointsOdds: null,
                      pointsGoals: null,
                      pointsStadium: null,
                      pointsTotal: null,
                    })
                  }
                  className="w-full border rounded px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="grid grid-cols-[33%_33%_33%] items-center gap-2">
                    <div className="font-semibold text-[13px] sm:text-base truncate text-left">
                      <span className="hidden sm:inline">{team.teamName}</span>
                      <span className="sm:hidden">{team.shortName || team.teamName}</span>
                    </div>

                    <div className="text-[11px] sm:text-sm text-gray-500 truncate text-left">
                      {team.side === 'home'
                        ? `🏠 ${team.shortOpponentName || team.opponentName}`
                        : `✈️ ${team.shortOpponentName || team.opponentName}`}
                    </div>

                    <div className="text-[12px] sm:text-sm whitespace-nowrap flex justify-start items-center">
                      <span className={`inline-block w-7 text-center ${getPointsColor(team.vPoints)}`}>
                        {team.vPoints ?? '-'}
                      </span>
                      <span className="mx-0.5 text-gray-500">|</span>
                      <span className={`inline-block w-7 text-center ${getPointsColor(team.nPoints)}`}>
                        {team.nPoints ?? '-'}
                      </span>
                      <span className="mx-0.5 text-gray-500">|</span>
                      <span className={`inline-block w-7 text-center ${getPointsColor(team.dPoints)}`}>
                        {team.dPoints ?? '-'}
                      </span>
                    </div>

                  </div>
                </button>
              ))
            )}
          </div>

          </div>
        </div>
      )}

      {/* ============================== */}
      {/* 🔹 POP-UP VAR POUR UNE EQUIPE */}
      {/* ============================== */}
      {varOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between border-b p-4">
                  <h3 className="text-lg font-semibold">
                    Détail VAR
                  </h3>
                  <button
                    type="button"
                    onClick={closeVar}
                    className="px-3 py-1 border rounded hover:bg-gray-50"
                  >
                    Fermer
                  </button>
                </div>

                {(() => {
                  const team = getSelectedTeamBySlot(varSlot);
                  const coeff = getCoeffBySlot(varSlot);
                  const weightedTotal = getWeightedTotal(team, varSlot);

                  return (
                    <div className="p-4 space-y-4">
                      <div className="text-center font-semibold text-lg">
                        {team?.teamName ?? 'Équipe inconnue'}
                      </div>

                      <div className="border rounded p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Base fixe</span>
                          <span>45</span>
                        </div>
                        <div className="flex justify-between">
                          <span>C (cote)</span>
                          <span>{team?.pointsOdds ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>E (écart)</span>
                          <span>{team?.pointsGoals ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>S (stade)</span>
                          <span>{team?.pointsStadium ?? '-'}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>Total brut</span>
                          <span>{team?.pointsTotal ?? '-'}</span>
                        </div>
                      </div>

                      {coeff !== 1 && (
                        <div className="border rounded p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Coefficient</span>
                            <span>x{coeff}</span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-2">
                            <span>Total pondéré</span>
                            <span>{weightedTotal ?? '-'}</span>
                          </div>
                        </div>
                      )}

                      {coeff === 1 && (
                        <div className="border rounded p-3">
                          <div className="flex justify-between font-semibold text-sm">
                            <span>Total final</span>
                            <span>{weightedTotal ?? '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
        </div>
      )}

      {/* ============================== */}
      {/* 🔹 POP-UP VAR POUR UN MATCH */}
      {/* ============================== */}
      {matchVarOpen && selectedMatchVar && selectedMatchVarPerf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl overflow-hidden">
            <div className="relative p-4">
              <h3 className="text-lg font-semibold text-center">
                Détail du match
              </h3>
              <button
                type="button"
                onClick={closeMatchVar}
                className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 border rounded hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="text-center text-sm text-gray-500 mb-4">
                {selectedMatchVar.home_team} vs {selectedMatchVar.away_team}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* COLONNE DOMICILE */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-center font-semibold text-lg">
                    {selectedMatchVar.home_team}
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Base fixe</span>
                      <span>45</span>
                    </div>
                    <div className="flex justify-between">
                      <span>C (Cote)</span>
                      <span>{selectedMatchVarPerf.home_c}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>E (Écart)</span>
                      <span>{selectedMatchVarPerf.home_e}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>S (Supporters)</span>
                      <span>{selectedMatchVarPerf.home_s}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total</span>
                      <span>{selectedMatchVarPerf.home_total}</span>
                    </div>
                  </div>
                </div>

                {/* COLONNE EXTÉRIEURE */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-center font-semibold text-lg">
                    {selectedMatchVar.away_team}
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Base fixe</span>
                      <span>45</span>
                    </div>
                    <div className="flex justify-between">
                      <span>C (Cote)</span>
                      <span>{selectedMatchVarPerf.away_c}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>E (Écart)</span>
                      <span>{selectedMatchVarPerf.away_e}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>S (Supporters)</span>
                      <span>{selectedMatchVarPerf.away_s}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total</span>
                      <span>{selectedMatchVarPerf.away_total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}