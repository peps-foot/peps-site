'use client';

import { useEffect, useState } from 'react';
import supabase from '../../../lib/supabaseBrowser';
import Image from 'next/image';

type SupporterMatch = {
    match_id: string;
    fixture_id: number | null;
    match_date: string;

    team_home_id: number | null;
    team_away_id: number | null;

    home_team: string | null;
    away_team: string | null;

    home_logo: string | null;
    away_logo: string | null;

    score_home: number | null;
    score_away: number | null;

    short_name_home: string | null;
    short_name_away: string | null;

    status: string | null;
    league_id: number | null;
};

type SupporterScreenProps = {
    competitionId: string;
    isPrivate: boolean;
};

type SupporterView =
    | 'pronostics'
    | 'rankGeneral'
    | 'rankMonth'
    | 'rules'
    | 'info';

type SupporterScore = {
    user_id: string;
    match_id: string;
    predicted_home_score: number;
    predicted_away_score: number;
    score_home: number | null;
    score_away: number | null;
    points: number;
};

type SupporterLeaderboardRow = {
    user_id: string;
    username: string | null;
    avatar: string | null;
    total_points: number;
    rank: number;
};

{/* ── Bonus SUPPORTER posé ── */}
type SupporterBonus = {
    id: string;
    competition_id: string;
    user_id: string;
    match_id: string;
    bonus_definition: string;
    code: string;
    name: string;
};

{/* ── Bonus SUPPORTER disponible dans la compétition ── */}
type SupporterBonusDef = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rule: string | null;
  max_per_user: number;
};

export default function SupporterScreen({
    competitionId,
    isPrivate,
}: SupporterScreenProps) {
    const [matches, setMatches] = useState<SupporterMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<SupporterView>('pronostics');
    {/* ── Bonus SUPPORTER du joueur ── */}
    const [supporterBonuses, setSupporterBonuses] = useState<SupporterBonus[]>([]);
    {/* ── Liste des bonus SUPPORTER disponibles ── */}
    const [supporterBonusDefs, setSupporterBonusDefs] = useState<SupporterBonusDef[]>([]);
    {/* ── Pour la gestion des pop-up BONUS ── */}
    const [openBonus, setOpenBonus] = useState(true);
    const [openedBonus, setOpenedBonus] = useState<SupporterBonusDef | null>(null);
    {/* ── Popup bonus SUPPORTER ── */}
    const [selectedBonusMatchId, setSelectedBonusMatchId] = useState<string>('');

    // Pour charger les matchs de la compétition
    useEffect(() => {
        if (!competitionId) return;

        async function loadMatches() {
            const { data, error } = await supabase.rpc('get_supporter_matches', {
                p_competition_id: competitionId,
            });

            if (error) {
                console.error('Erreur get_supporter_matches:', error);
                setMatches([]);
            } else {
                setMatches(data || []);
            }

            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            if (userId) {
                {/* ── Chargement des pronostics déjà validés ── */ }
                const { data: predictionsData, error: predictionsError } = await supabase
                    .from('supporter_predictions')
                    .select('match_id, predicted_home_score, predicted_away_score')
                    .eq('competition_id', competitionId)
                    .eq('user_id', userId);

                if (!predictionsError) {
                    const predictionsMap: Record<string, { home: number; away: number }> = {};
                    const inputsMap: Record<string, { home: string; away: string }> = {};

                    (predictionsData || []).forEach((p) => {
                        predictionsMap[p.match_id] = {
                            home: p.predicted_home_score,
                            away: p.predicted_away_score,
                        };

                        inputsMap[p.match_id] = {
                            home: String(p.predicted_home_score),
                            away: String(p.predicted_away_score),
                        };
                    });

                    setSavedPredictions(predictionsMap);
                    setScoreInputs(inputsMap);
                }

                {/* ── Chargement des points calculés ── */ }
                const { data: scoresData, error: scoresError } = await supabase.rpc(
                    'compute_supporter_scores',
                    { p_competition_id: competitionId }
                );

                if (!scoresError) {
                    const scoresMap: Record<string, number> = {};

                    ((scoresData || []) as SupporterScore[])
                        .filter((s) => s.user_id === userId)
                        .forEach((s) => {
                            scoresMap[s.match_id] = s.points;
                        });

                    setPointsByMatch(scoresMap);
                }

                {/* ── Chargement du classement général SUPPORTER ── */ }
                const { data: leaderboardData, error: leaderboardError } =
                    await supabase.rpc('get_supporter_leaderboard_general', {
                        p_competition_id: competitionId,
                    });

                if (!leaderboardError) {
                    setLeaderboardGeneral(
                        (leaderboardData || []) as SupporterLeaderboardRow[]
                    );
                }
            }

            {/* ── Chargement des bonus SUPPORTER ── */ }
            const { data: bonusData, error: bonusError } = await supabase
                .from('supporter_bonus')
                .select(`
                id,
                competition_id,
                user_id,
                match_id,
                bonus_definition,
                bonus_def:bonus_definition (
                    code,
                    name
                )
                `)
                .eq('competition_id', competitionId)
                .eq('user_id', userId);

            if (bonusError) {
                console.error('Erreur chargement supporter_bonus:', bonusError);
            } else {
const formattedBonuses: SupporterBonus[] = (bonusData || []).map((b: any) => ({
  id: b.id,
  competition_id: b.competition_id,
  user_id: b.user_id,
  match_id: b.match_id,
  bonus_definition: b.bonus_definition,
  code: b.bonus_def?.code ?? '',
  name: b.bonus_def?.name ?? '',
}));
                setSupporterBonuses(formattedBonuses);
            }

            {/* ── Chargement des bonus autorisés pour cette compétition ── */}
            const { data: bonusDefsData, error: bonusDefsError } = await supabase
            .from('competition_bonus_caps')
            .select(`
                max_per_user,
                bonus_definition (
                id,
                code,
                name,
                description,
                rule
                )
            `)
            .eq('competition_id', competitionId);

            if (bonusDefsError) {
            console.error('Erreur chargement competition_bonus_caps:', bonusDefsError);
            } else {
            const formattedBonusDefs: SupporterBonusDef[] = (bonusDefsData || []).map((row: any) => ({
                id: row.bonus_definition.id,
                code: row.bonus_definition.code,
                name: row.bonus_definition.name,
                description: row.bonus_definition.description,
                rule: row.bonus_definition.rule,
                max_per_user: row.max_per_user,
            }));

            setSupporterBonusDefs(formattedBonusDefs);
            }

            setLoading(false);
        }

        loadMatches();
    }, [competitionId]);

    // Pour gérer le carroussel des mois
    const [currentMonthIdx, setCurrentMonthIdx] = useState(0);

    const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric',
    });

    const months = Array.from(
        new Map(
            matches.map((match) => {
                const d = new Date(match.match_date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                return [
                    key,
                    {
                        key,
                        title: monthFormatter.format(d),
                        matches: matches.filter((m) => {
                            const dm = new Date(m.match_date);
                            const mKey = `${dm.getFullYear()}-${String(dm.getMonth() + 1).padStart(2, '0')}`;
                            return mKey === key;
                        }),
                    },
                ];
            })
        ).values()
    );

    const currentMonth = months[currentMonthIdx];

    function prevMonth() {
        setCurrentMonthIdx((idx) => Math.max(0, idx - 1));
    }

    function nextMonth() {
        setCurrentMonthIdx((idx) => Math.min(months.length - 1, idx + 1));
    }

    {/* ── Chargement du classement du mois affiché ── */ }
    useEffect(() => {
        if (!competitionId || !currentMonth) return;

        async function loadMonthLeaderboard() {
            const firstMatchDate = new Date(currentMonth.matches[0].match_date);

            const monthStart = new Date(
                firstMatchDate.getFullYear(),
                firstMatchDate.getMonth(),
                1
            );

            const monthEnd = new Date(
                firstMatchDate.getFullYear(),
                firstMatchDate.getMonth() + 1,
                0
            );

            const formatDate = (d: Date) =>
                d.toISOString().split('T')[0];

            const { data, error } = await supabase.rpc(
                'get_supporter_leaderboard_month',
                {
                    p_competition_id: competitionId,
                    p_month_start: formatDate(monthStart),
                    p_month_end: formatDate(monthEnd),
                }
            );

            if (error) {
                console.error('Erreur classement mensuel:', error);
            } else {
                setLeaderboardMonth(
                    (data || []) as SupporterLeaderboardRow[]
                );
            }
        }

        loadMonthLeaderboard();
    }, [competitionId, currentMonth]);

    {/* ── Sélection automatique du mois le plus pertinent ── */ }
    useEffect(() => {
        if (months.length === 0) return;

        // 1) Priorité : premier mois avec un match à venir
        const firstMonthWithNS = months.findIndex((month) =>
            month.matches.some((match) => {
                const status = String(match.status ?? '').toUpperCase();
                const matchStarted = new Date(match.match_date).getTime() <= Date.now();

                return status === 'NS' && !matchStarted;
            })
        );

        if (firstMonthWithNS !== -1) {
            setCurrentMonthIdx(firstMonthWithNS);
            return;
        }

        // 2) Sinon : premier mois avec un match en cours
        const liveStatuses = ['1H', '2H', 'HT'];

        const firstMonthWithLive = months.findIndex((month) =>
            month.matches.some((match) =>
                liveStatuses.includes(String(match.status ?? '').toUpperCase())
            )
        );

        if (firstMonthWithLive !== -1) {
            setCurrentMonthIdx(firstMonthWithLive);
            return;
        }

        // 3) Sinon : tous les matchs sont terminés, on va au dernier mois
        setCurrentMonthIdx(months.length - 1);
    }, [matches]);

    // Pour enregistrer les scores
    {/* ── Scores saisis localement avant validation ── */ }
    const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({});
    {/* ── Pronostics déjà validés en base ── */ }
    const [savedPredictions, setSavedPredictions] = useState<Record<string, { home: number; away: number }>>({});
    {/* ── Modification locale d’un score avant validation ── */ }
    function handleScoreChange(
        matchId: string,
        side: 'home' | 'away',
        value: string
    ) {
        setScoreInputs((prev) => ({
            ...prev,
            [matchId]: {
                home: side === 'home' ? value : prev[matchId]?.home ?? '',
                away: side === 'away' ? value : prev[matchId]?.away ?? '',
            },
        }));
    }
    {/* ── Validation du score en base ── */ }
    async function handleValidateScore(matchId: string) {
        const input = scoreInputs[matchId];

        if (!input || input.home === '' || input.away === '') {
            alert('Entre les deux scores avant de valider.');
            return;
        }

        const homeScore = Number(input.home);
        const awayScore = Number(input.away);

        if (
            Number.isNaN(homeScore) ||
            Number.isNaN(awayScore) ||
            homeScore < 0 ||
            awayScore < 0
        ) {
            alert('Scores invalides.');
            return;
        }

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        if (!userId) {
            alert('Tu dois être connecté pour valider ton prono.');
            return;
        }

        const { error } = await supabase
            .from('supporter_predictions')
            .upsert(
                {
                    competition_id: competitionId,
                    user_id: userId,
                    match_id: matchId,
                    predicted_home_score: homeScore,
                    predicted_away_score: awayScore,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'competition_id,user_id,match_id',
                }
            );

        if (error) {
            console.error(error);
            alert('Erreur lors de la validation.');
            return;
        }

        setSavedPredictions((prev) => ({
            ...prev,
            [matchId]: {
                home: homeScore,
                away: awayScore,
            },
        }));
    }

    {/* ── Points calculés par match pour le joueur connecté ── */ }
    const [pointsByMatch, setPointsByMatch] = useState<Record<string, number>>({});
    {/* ── Classement général SUPPORTER ── */ }
    const [leaderboardGeneral, setLeaderboardGeneral] = useState<SupporterLeaderboardRow[]>([]);
    {/* ── Classement mensuel SUPPORTER ── */ }
    const [leaderboardMonth, setLeaderboardMonth] = useState<SupporterLeaderboardRow[]>([]);
    {/* ── Total des points du mois affiché ── */ }
    const monthTotalPoints =
        currentMonth?.matches.reduce((total, match) => {
            return total + (pointsByMatch[match.match_id] ?? 0);
        }, 0) ?? 0;
    
    {/* ── Logos des bonus SUPPORTER ── */}
    const supporterBonusLogos: Record<string, string> = {
    HAT_TRICK: '/images/bonus/hat_trick.png',
    DOUBLE_CONTACT: '/images/bonus/double_contact.png',
    POTEAU_RENTRANT: '/images/bonus/poteau_rentrant.png',
    };

    {/* ── Validation d’un bonus SUPPORTER ── */}
    const handleSupporterBonusValidate = async (
    bonusDefinitionId: string,
    matchId: string
    ) => {
    if (!matchId) {
        alert('Choisis un match.');
        return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
        alert('Utilisateur non connecté.');
        return;
    }

    const { data, error } = await supabase.rpc(
        'play_supporter_bonus',
        {
        p_competition_id: competitionId,
        p_user_id: userId,
        p_match_id: matchId,
        p_bonus_definition: bonusDefinitionId,
        }
    );

    if (error) {
        alert(error.message);
        return;
    }

    const result = data?.[0];

    if (!result?.ok) {
        alert(result?.message ?? 'Impossible de jouer ce bonus.');
        return;
    }

    // ── Rechargement des bonus ──
    const { data: bonusData } = await supabase
        .from('supporter_bonus')
        .select(`
        id,
        competition_id,
        user_id,
        match_id,
        bonus_definition,
        bonus_def:bonus_definition (
            code,
            name
        )
        `)
        .eq('competition_id', competitionId)
        .eq('user_id', userId);

const formattedBonuses: SupporterBonus[] = (bonusData || []).map((b: any) => ({
  id: b.id,
  competition_id: b.competition_id,
  user_id: b.user_id,
  match_id: b.match_id,
  bonus_definition: b.bonus_definition,
  code: b.bonus_def?.code ?? '',
  name: b.bonus_def?.name ?? '',
}));

    setSupporterBonuses(formattedBonuses);

    setOpenedBonus(null);
    setSelectedBonusMatchId('');
    };

    {/* ── Suppression d’un bonus SUPPORTER ── */}
    const handleSupporterBonusDelete = async (
    bonusId: string
    ) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
        alert('Utilisateur non connecté.');
        return;
    }

    const { data, error } = await supabase.rpc(
        'delete_supporter_bonus',
        {
        p_competition_id: competitionId,
        p_user_id: userId,
        p_bonus_id: bonusId,
        }
    );

    if (error) {
        alert(error.message);
        return;
    }

    const result = data?.[0];

    if (!result?.ok) {
        alert(result?.message ?? 'Impossible de supprimer ce bonus.');
        return;
    }

    // ── Rechargement des bonus ──
    const { data: bonusData } = await supabase
        .from('supporter_bonus')
        .select(`
        id,
        competition_id,
        user_id,
        match_id,
        bonus_definition,
        bonus_def:bonus_definition (
            code,
            name
        )
        `)
        .eq('competition_id', competitionId)
        .eq('user_id', userId);

const formattedBonuses: SupporterBonus[] = (bonusData || []).map((b: any) => ({
  id: b.id,
  competition_id: b.competition_id,
  user_id: b.user_id,
  match_id: b.match_id,
  bonus_definition: b.bonus_definition,
  code: b.bonus_def?.code ?? '',
  name: b.bonus_def?.name ?? '',
}));

    setSupporterBonuses(formattedBonuses);

    setOpenedBonus(null);
    setSelectedBonusMatchId('');
    };

    if (loading) {
        return <div className="p-6 text-white">Chargement des matchs…</div>;
    }

    return (
        <main className="p-4">

            {/* ── Carroussel pour les mois ── */}
            <div className="border border-white/20 rounded-lg p-4 flex items-center justify-center gap-4 mb-4">
                <button
                    onClick={prevMonth}
                    disabled={months.length === 0 || currentMonthIdx === 0}
                    className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mois précédent"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <span className="text-2xl font-semibold text-center capitalize">
                    {currentMonth?.title || 'Chargement...'}
                </span>

                <button
                    onClick={nextMonth}
                    disabled={months.length === 0 || currentMonthIdx === months.length - 1}
                    className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mois suivant"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            {/* ── Zone info avec les pastilles qui mènent aux vues ── */}
            <div className="border border-white/20 rounded-lg p-4 flex items-center justify-center gap-4 mb-4">
                {/* 1) Pronostics */}
                <button
                    onClick={() => setView('pronostics')}
                    aria-pressed={view === 'pronostics'}
                    className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'pronostics' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                    title="Faire mes pronos"
                >
                    <Image
                        src="/images/icons/grille.png"
                        alt="Pronos"
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                    />
                </button>

                {/* 2) Points */}
                <div
                    className="w-12 h-12 rounded-full border flex items-center justify-center text-base font-semibold select-none"
                    title="Points du mois sélectionné"
                    aria-label="Points du mois"
                >
                    {monthTotalPoints}
                </div>

                {/* 3) Classement général */}
                <button
                    onClick={() => setView('rankGeneral')}
                    aria-pressed={view === 'rankGeneral'}
                    className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rankGeneral' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                    title="Classement général"
                >
                    <Image
                        src="/images/icons/podium.png"
                        alt="Général"
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                    />
                </button>

                {/* 4) Classement du mois */}
                <button
                    onClick={() => setView('rankMonth')}
                    aria-pressed={view === 'rankMonth'}
                    className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rankMonth' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                    title="Classement du mois"
                >
                    <Image
                        src="/images/icons/classement.png"
                        alt="Mois"
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                    />
                </button>

                {/* 5) Infos compétition privée */}
                {isPrivate && (
                    <button
                        onClick={() => setView('info')}
                        aria-pressed={view === 'info'}
                        className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'info' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                        title="Infos de la compétition"
                    >
                        <Image
                            src="/images/icons/info.png"
                            alt="Infos"
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                        />
                    </button>
                )}

                {/* 6) Règles */}
                <button
                    onClick={() => setView('rules')}
                    aria-pressed={view === 'rules'}
                    className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rules' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
                    title="Règles"
                >
                    <Image
                        src="/images/icons/regles.png"
                        alt="Règles"
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                    />
                </button>
            </div>

            {/* ── Vue PRONOSTICS : zone matchs + zone bonus ── */}
            {view === 'pronostics' && (
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* ── Colonne gauche : matchs du mois, 2/3 sur grand écran ── */}
                    <div className="w-full lg:w-2/3">
                        <div className="border rounded-lg">
                            <button
                                type="button"
                                className="w-full flex items-center px-4 py-3"
                            >
                                <span className="font-semibold text-center flex-1">
                                    🎯 Fais tes pronos
                                </span>
                            </button>

                            <div className="px-4 pb-4 space-y-2">
                                <div className="space-y-3">
                                    {currentMonth?.matches.map((match) => {
                                        const status = String(match.status ?? '').toUpperCase();
                                        const matchStarted = new Date(match.match_date).getTime() <= Date.now();
                                        const isLocked = status !== 'NS' || matchStarted;
                                        const savedPrediction = savedPredictions[match.match_id];
                                        const bonusForThisMatch = supporterBonuses.find((b) => b.match_id === match.match_id);

                                        return (
                                            <div
                                                key={match.match_id}
                                                className="border rounded-lg grid grid-cols-[14%_24%_27%_24%_11%] gap-x-2 gap-y-0 items-center p-2"
                                            >
                                                {/* ── Ligne 1 / Colonne 1 : date ── */}
                                                <div className="text-center text-sm">
                                                    {new Date(match.match_date).toLocaleDateString('fr-FR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                    })}{' '}
                                                    {new Date(match.match_date).toLocaleTimeString('fr-FR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>

                                                {/* ── Ligne 1 / Colonne 2 : équipe domicile ── */}
                                                {/* ── Équipe domicile : short mobile, nom complet PC ── */}
                                                <div className="text-center font-medium">
                                                    <span className="sm:hidden">{match.short_name_home ?? match.home_team}</span>
                                                    <span className="hidden sm:inline">{match.home_team}</span>
                                                </div>

                                                {/* ── Ligne 1 / Colonnes 3-4 : saisie score ou score réel ── */}
                                                <div className="flex items-center justify-center gap-2">
                                                    {isLocked ? (
                                                        savedPrediction ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="w-10 h-8 border rounded text-center font-semibold flex items-center justify-center bg-gray-100">
                                                                    {savedPrediction.home}
                                                                </div>

                                                                <span className="font-bold">-</span>

                                                                <div className="w-10 h-8 border rounded text-center font-semibold flex items-center justify-center bg-gray-100">
                                                                    {savedPrediction.away}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-500 italic">
                                                                Non joué
                                                            </span>
                                                        )
                                                    ) : (
                                                        <>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={scoreInputs[match.match_id]?.home ?? savedPredictions[match.match_id]?.home ?? ''}
                                                                onChange={(e) => handleScoreChange(match.match_id, 'home', e.target.value)}
                                                                className="w-10 h-8 border rounded text-center font-semibold"
                                                                placeholder="-"
                                                            />

                                                            <span className="font-bold">-</span>

                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={scoreInputs[match.match_id]?.away ?? savedPredictions[match.match_id]?.away ?? ''}
                                                                onChange={(e) => handleScoreChange(match.match_id, 'away', e.target.value)}
                                                                className="w-10 h-8 border rounded text-center font-semibold"
                                                                placeholder="-"
                                                            />
                                                        </>
                                                    )}
                                                </div>

                                                {/* ── Ligne 1 / Colonne 4 : équipe extérieure ── */}
                                                {/* ── Équipe extérieure : short mobile, nom complet PC ── */}
                                                <div className="text-center font-medium">
                                                    <span className="sm:hidden">{match.short_name_away ?? match.away_team}</span>
                                                    <span className="hidden sm:inline">{match.away_team}</span>
                                                </div>

                                                {/* ── Ligne 1 / Colonne 5 : VAR / bonus futur ── */}
                                                <div className="flex justify-center">
                                                    <button className="focus:outline-none">
<img
  src={
    bonusForThisMatch
      ? supporterBonusLogos[bonusForThisMatch.code]
      : '/images/info.png'
  }
  alt={bonusForThisMatch ? bonusForThisMatch.name : 'Infos pronos'}
  className="w-8 h-8 rounded-full"
/>
                                                    </button>
                                                </div>

                                                {/* ── Ligne 2 / Colonne 1 : statut ── */}
                                                <div className="text-center text-xs text-blue-600">
                                                    {isLocked ? 'Terminé' : 'À venir'}
                                                </div>

                                                {/* ── Ligne 2 / Colonne 2 : logo home ou score home ── */}
                                                <div className="text-center font-semibold">
                                                    {isLocked ? (
                                                        match.score_home ?? ''
                                                    ) : match.home_logo ? (
                                                        <img
                                                            src={match.home_logo}
                                                            alt={match.home_team ?? ''}
                                                            className="w-5 h-5 mx-auto object-contain"
                                                            loading="lazy"
                                                        />
                                                    ) : null}
                                                </div>

                                                {/* ── Ligne 2 / Colonnes 3-4 : bouton valider ou points futurs ── */}
                                                <div className="flex justify-center">
                                                    {!isLocked ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleValidateScore(match.match_id)}
                                                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                                                        >
                                                            Valider
                                                        </button>
                                                    ) : (
                                                        <span></span>
                                                    )}
                                                </div>

                                                {/* ── Ligne 2 / Colonne 4 : logo away ou score away ── */}
                                                <div className="text-center font-semibold">
                                                    {isLocked ? (
                                                        match.score_away ?? ''
                                                    ) : match.away_logo ? (
                                                        <img
                                                            src={match.away_logo}
                                                            alt={match.away_team ?? ''}
                                                            className="w-5 h-5 mx-auto object-contain"
                                                            loading="lazy"
                                                        />
                                                    ) : null}
                                                </div>

                                                {/* ── Ligne 2 / Colonne 5 : coche validée ou points ── */}
                                                <div className="text-center text-sm">
                                                    {isLocked ? (
                                                        `${pointsByMatch[match.match_id] ?? 0} pts`
                                                    ) : savedPrediction ? (
                                                        <span className="text-green-600 font-bold text-lg">✓</span>
                                                    ) : (
                                                        ''
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Colonne droite : bonus, 1/3 sur grand écran et dessous sur mobile ── */}
                    {/* ── ZONE BONUS SUPPORTER ── */}
                    <div className="w-full lg:w-1/3 space-y-4">

                    {/* ── Accordéon BONUS ── */}
                    <div className="border rounded-lg">
                        
                        {/* ── Header accordéon ── */}
                        <button
                        type="button"
                        onClick={() => setOpenBonus(!openBonus)}
                        className="w-full flex items-center justify-between px-4 py-3"
                        >
                        <span className="font-semibold text-center w-full">
                            🎁 Gère tes bonus
                        </span>

                        <span className="text-xl">
                            {openBonus ? '▲' : '▼'}
                        </span>
                        </button>

                        {/* ── Contenu ── */}
                        {openBonus && (
                        <div className="px-4 pb-4 space-y-3">

                            {supporterBonusDefs.map((bonus) => {

                            const usedCount = supporterBonuses.filter(
                                (b) => b.bonus_definition === bonus.id
                            ).length;

                            const remaining = bonus.max_per_user - usedCount;

                            const hasEditableBonus = supporterBonuses.some((b) => {
                                if (b.bonus_definition !== bonus.id) return false;

                                const match = matches.find(
                                (m) => m.match_id === b.match_id
                                );

                                if (!match) return false;

                                const status = String(match.status ?? '').toUpperCase();

                                return (
                                status === 'NS' &&
                                new Date(match.match_date).getTime() > Date.now()
                                );
                            });

                            return (
                                <div
                                key={bonus.id}
                                className="border rounded-lg p-3 flex items-center justify-between gap-3"
                                >

                                {/* ── Logo + infos ── */}
                                <div className="flex items-center gap-3 min-w-0">

                                    <img
                                    src={supporterBonusLogos[bonus.code]}
                                    alt={bonus.name}
                                    className="w-12 h-12 rounded-full border shrink-0"
                                    />

                                    <div className="min-w-0">
                                        <div className="min-w-0">
                                        
                                        {/* ── Nom + stock restant ── */}
                                        <div className="font-semibold leading-5">
                                            {bonus.name}{' '}
                                            
                                            <span className="text-green-700 font-medium">
                                            (
                                            {bonus.max_per_user >= 999
                                                ? '∞'
                                                : `${remaining} restant${remaining > 1 ? 's' : ''}`
                                            }
                                            )
                                            </span>
                                        </div>

                                        {/* ── Description rapide ── */}
                                        <div className="text-sm text-gray-600 leading-5">
                                            {bonus.description}
                                        </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Bouton gérer ── */}
                                {(remaining > 0 || hasEditableBonus) && (
                                    <button
                                    onClick={() => setOpenedBonus(bonus)}
                                    className="px-3 py-2 bg-white border rounded text-sm shrink-0 hover:bg-gray-50"
                                    >
                                    GÉRER
                                    </button>
                                )}
                                </div>
                            );
                            })}
                        </div>
                        )}
                    </div>
                    </div>
                </div>
            )}

            {/* ── Vue CLASSEMENT GÉNÉRAL SUPPORTER ── */}
            {view === 'rankGeneral' && (
                <div className="border rounded-lg overflow-hidden">

                    {/* ── Titre ── */}
                    <div className="px-4 py-3 border-b font-semibold text-center">
                        🏆 Classement général
                    </div>

                    {/* ── Liste des joueurs ── */}
                    <div className="divide-y">
                        {leaderboardGeneral.map((player) => (
                            <div
                                key={player.user_id}
                                className="grid grid-cols-[14%_16%_1fr_20%] items-center px-3 py-2"
                            >
                                {/* ── Rang ── */}
                                <div className="text-center font-bold">
                                    {player.rank}
                                </div>

                                {/* ── Avatar ── */}
                                <div className="flex justify-center">
                                    {player.avatar ? (
                                        <img
                                            src={player.avatar}
                                            alt={player.username ?? 'avatar'}
                                            className="w-8 h-8 rounded-full object-cover border"
                                        />
                                    ) : null}
                                </div>

                                {/* ── Username ── */}
                                <div className="font-medium truncate px-2">
                                    {player.username ?? 'Joueur'}
                                </div>

                                {/* ── Points ── */}
                                <div className="text-right font-semibold">
                                    {player.total_points} pts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Vue CLASSEMENT DU MOIS ── */}
            {view === 'rankMonth' && (
                <div className="border rounded-lg overflow-hidden">

                    {/* ── Titre ── */}
                    <div className="px-4 py-3 border-b font-semibold text-center">
                        📅 Classement du mois
                    </div>

                    {/* ── Liste des joueurs ── */}
                    <div className="divide-y">
                        {leaderboardMonth.map((player) => (
                            <div
                                key={player.user_id}
                                className="grid grid-cols-[14%_16%_1fr_20%] items-center px-3 py-2"
                            >
                                {/* ── Rang ── */}
                                <div className="text-center font-bold">
                                    {player.rank}
                                </div>

                                {/* ── Avatar ── */}
                                <div className="flex justify-center">
                                    {player.avatar ? (
                                        <img
                                            src={player.avatar}
                                            alt={player.username ?? 'avatar'}
                                            className="w-8 h-8 rounded-full object-cover border"
                                        />
                                    ) : null}
                                </div>

                                {/* ── Username ── */}
                                <div className="font-medium truncate px-2">
                                    {player.username ?? 'Joueur'}
                                </div>

                                {/* ── Points ── */}
                                <div className="text-right font-semibold">
                                    {player.total_points} pts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Vue REGLES ── */}
            {view === 'rules' && (
                <div className="space-y-3 text-sm leading-6">
                    {/* ── Titre des règles ── */}
                    <div className="px-4 py-3 text-center font-semibold bg-white">
                        📣 Règles du jeu
                    </div>

                    {/* ── Accordéon 1 : principe + points ── */}
                    <details open className="group rounded-lg border bg-gray-50">
                        <summary className="list-none cursor-pointer px-4 py-3 font-bold flex items-center justify-between">
                            <span>🎯 Principe & points</span>
                            <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>

                        <div className="px-4 pb-4 space-y-3">
                            <p>
                                Parie sur le score des matchs de ton équipe préférée.
                                Tu peux modifier ton prono jusqu’au coup d’envoi.
                                Après, le match est verrouillé.
                            </p>

                            <ul className="list-disc pl-5 space-y-1">
                                <li>
                                    Bon résultat : victoire, nul ou défaite =
                                    <strong> 2 pts</strong>
                                </li>

                                <li>
                                    Bon écart de buts =
                                    <strong> +1 pt</strong>
                                </li>

                                <li>
                                    Score exact =
                                    <strong> +2 pts</strong>
                                </li>
                            </ul>

                            <p className="font-semibold">
                                Score parfait : 5 points maximum.
                            </p>
                        </div>
                    </details>

                    {/* ── Accordéon 2 : bonus ── */}
                    <details className="group rounded-lg border bg-orange-50">
                        <summary className="list-none cursor-pointer px-4 py-3 font-bold flex items-center justify-between">
                            <span>🎁 Les bonus</span>
                            <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>

                        <div className="px-4 pb-4 space-y-2">
                            <ul className="list-disc pl-5 space-y-1">
                                <li>
                                    <strong>HAT TRICK</strong> :
                                    tes points sont triplés.
                                </li>

                                <li>
                                    <strong>DOUBLE CONTACT</strong> :
                                    tes points sont doublés.
                                </li>

                                <li>
                                    <strong>POTEAU RENTRANT</strong> :
                                    si ton score est à 1 but près,
                                    le score exact est validé.
                                </li>
                            </ul>

                            <p className="text-gray-700">
                                Attention, les bonus sont limités :
                                choisis bien tes matchs.
                            </p>
                        </div>
                    </details>

                    {/* ── Accordéon 3 : exemples ── */}
                    <details className="group rounded-lg border bg-gray-50">
                        <summary className="list-none cursor-pointer px-4 py-3 font-bold flex items-center justify-between">
                            <span>🇫🇷 Exemples</span>
                            <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>

                        <div className="px-4 pb-4 space-y-3">
                            <p>
                                Tu paries <strong>France 3 - 0 Brésil</strong>.
                            </p>

                            <ul className="space-y-2">
                                <li>
                                    ✅ Score final <strong>2 - 0</strong> :
                                    bon résultat = <strong>2 pts</strong>.
                                    Avec <strong>POTEAU RENTRANT</strong>,
                                    ton score est validé comme exact :
                                    <strong> 5 pts</strong>.
                                </li>

                                <li>
                                    ✅ Score final <strong>4 - 1</strong> :
                                    bon résultat + bon écart =
                                    <strong> 3 pts</strong>.
                                </li>

                                <li>
                                    🎯 Score final <strong>3 - 0</strong> :
                                    score exact =
                                    <strong> 5 pts</strong>.
                                </li>
                            </ul>
                        </div>
                    </details>
                </div>
            )}

            {/* ── Vue INFO si mode PRIVATE ── */}
            {view === 'info' && (
                <div className="border border-white/20 rounded-lg p-4 text-center">
                    Infos compétition — en construction
                </div>
            )}

            {/* ── POPUP GÉRER BONUS SUPPORTER ── */}
            {openedBonus && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-5 w-full max-w-md relative">
                
                {/* ── Fermer ── */}
                <button
                    onClick={() => {
                    setOpenedBonus(null);
                    setSelectedBonusMatchId('');
                    }}
                    className="absolute top-2 right-3 text-xl"
                >
                    ✕
                </button>

                {/* ── Titre ── */}
                <div className="text-center mb-4">
                    <h2 className="text-xl font-bold">
                    {openedBonus.name}
                    </h2>
                    <p className="text-sm text-gray-600">
                    {openedBonus.description}
                    </p>
                </div>

                {/* ── Emplacements bonus ── */}
                <div className="space-y-4">
                    {Array.from({ length: openedBonus.max_per_user }).map((_, index) => {
                    const bonusPlaced = supporterBonuses.filter(
                        (b) => b.bonus_definition === openedBonus.id
                    )[index];

                    const placedMatch = bonusPlaced
                        ? matches.find((m) => m.match_id === bonusPlaced.match_id)
                        : null;

                    const isPlacedLocked = placedMatch
                        ? String(placedMatch.status ?? '').toUpperCase() !== 'NS' ||
                        new Date(placedMatch.match_date).getTime() <= Date.now()
                        : false;

                    const availableMatches =
                        currentMonth?.matches.filter((match) => {
                        const status = String(match.status ?? '').toUpperCase();
                        const matchStarted =
                            new Date(match.match_date).getTime() <= Date.now();

                        const alreadyHasBonus = supporterBonuses.some(
                            (b) =>
                            b.match_id === match.match_id &&
                            b.id !== bonusPlaced?.id
                        );

                        return (
                            status === 'NS' &&
                            !matchStarted &&
                            !alreadyHasBonus
                        );
                        }) ?? [];

                    return (
                        <div
                        key={index}
                        className="border rounded-lg p-3 bg-gray-50"
                        >
                        {/* ── Titre emplacement ── */}
                        <div className="font-semibold mb-2">
                            Bonus {index + 1}
                        </div>

                        {/* ── Cas : bonus déjà posé et verrouillé ── */}
                        {bonusPlaced && isPlacedLocked ? (
                            <div className="text-sm text-gray-700">
                            🔒 Déjà joué sur{' '}
                            <strong>
                                {placedMatch
                                ? `${placedMatch.short_name_home ?? placedMatch.home_team} - ${placedMatch.short_name_away ?? placedMatch.away_team}`
                                : 'match inconnu'}
                            </strong>
                            </div>
                        ) : (
                            <>
                            {/* ── Choix du match ── */}
                            <select
                                value={
                                selectedBonusMatchId ||
                                bonusPlaced?.match_id ||
                                ''
                                }
                                onChange={(e) =>
                                setSelectedBonusMatchId(e.target.value)
                                }
                                className="w-full border rounded px-3 py-2 text-sm bg-white"
                            >
                                <option value="">
                                Choisir un match du mois
                                </option>

                                {availableMatches.map((match) => (
                                <option
                                    key={match.match_id}
                                    value={match.match_id}
                                >
                                    {match.short_name_home ?? match.home_team}
                                    {' - '}
                                    {match.short_name_away ?? match.away_team}
                                </option>
                                ))}
                            </select>

                            {/* ── Boutons ── */}
                            <div className="mt-3 flex justify-center gap-3">
                                <button
                                type="button"
                                onClick={() =>
                                    handleSupporterBonusValidate(
                                    openedBonus.id,
                                    selectedBonusMatchId ||
                                        bonusPlaced?.match_id ||
                                        ''
                                    )
                                }
                                className="px-4 py-2 bg-green-600 text-white rounded text-sm"
                                >
                                Valider
                                </button>

                                {bonusPlaced && (
                                <button
                                    type="button"
                                    onClick={() =>
                                    handleSupporterBonusDelete(bonusPlaced.id)
                                    }
                                    className="px-4 py-2 bg-red-500 text-white rounded text-sm"
                                >
                                    Supprimer
                                </button>
                                )}
                            </div>
                            </>
                        )}
                        </div>
                    );
                    })}
                </div>
                </div>
            </div>
            )}



        </main>
    );
}