'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Tab = 'matches' | 'ranking' | 'add';

type CoincheProfile = {
    id: string;
    username: string;
    elo: number;
    matches_played: number;
    wins: number;
    losses: number;
};

type CoincheMatch = {
  id: string;
  team1_score: number;
  team2_score: number;

  team1_player1_elo_change: number;
  team1_player2_elo_change: number;
  team2_player1_elo_change: number;
  team2_player2_elo_change: number;

  played_at: string;

  team1_player1: {
    username: string;
  } | null;

  team1_player2: {
    username: string;
  } | null;

  team2_player1: {
    username: string;
  } | null;

  team2_player2: {
    username: string;
  } | null;
};

type CoinchePlayerStats = {
  other_player_id: string;
  other_player_username: string;

  with_matches: number;
  with_wins: number;
  with_losses: number;
  with_elo_points: number;

  against_matches: number;
  against_wins: number;
  against_losses: number;
  against_elo_points: number;

  total_matches: number;
  total_elo_points: number;
};

type PlayerStatsSort =
  | "alphabetical"
  | "matches"
  | "elo";

type EloHistoryPoint = {
  match: number;
  elo: number;
  date: string;
};

export default function CoinchePage() {
    const supabase = useSupabase();

    const [activeTab, setActiveTab] = useState<Tab>('ranking');
    const [players, setPlayers] = useState<CoincheProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [team1Player1, setTeam1Player1] = useState('');
    const [team1Player2, setTeam1Player2] = useState('');
    const [team2Player1, setTeam2Player1] = useState('');
    const [team2Player2, setTeam2Player2] = useState('');

    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');

    const [savingMatch, setSavingMatch] = useState(false);
    const [matchError, setMatchError] = useState<string | null>(null);
    const [matchSuccess, setMatchSuccess] = useState<string | null>(null);

    const [matches, setMatches] = useState<CoincheMatch[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);

    const [deletingLastMatch, setDeletingLastMatch] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [matchesCount, setMatchesCount] = useState(0);

    const [selectedPlayer, setSelectedPlayer] =   useState<CoincheProfile | null>(null);
    const [playerStatsOpen, setPlayerStatsOpen] = useState(false);

    const [playerStats, setPlayerStats] = useState<CoinchePlayerStats[]>([]);
    const [loadingPlayerStats, setLoadingPlayerStats] = useState(false);
    const [playerStatsError, setPlayerStatsError] = useState("");
    const [playerStatsSort, setPlayerStatsSort] =   useState<PlayerStatsSort>("alphabetical");

    const playersForSelect = [...players].sort((a, b) =>
      a.username.localeCompare(b.username, "fr", {
        sensitivity: "base",
      })
    );

    const [eloHistory, setEloHistory] = useState<EloHistoryPoint[]>([]);
    const [loadingEloHistory, setLoadingEloHistory] = useState(false);


    useEffect(() => {
      loadRanking();
      loadMatches();
    }, []);

    async function loadRanking() {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase
            .from('coinche_profiles')
            .select('id, username, elo, matches_played, wins, losses')
            .order('elo', { ascending: false })
            .order('wins', { ascending: false })
            .order('username', { ascending: true });

        if (error) {
            console.error('Erreur chargement classement coinche :', error);
            setErrorMsg('Impossible de charger le classement.');
            setPlayers([]);
        } else {
            setPlayers(data ?? []);
        }

        setLoading(false);
    }

    async function loadMatches() {
      setLoadingMatches(true);
      setMatchesError(null);

      const { data, error } = await supabase
        .from('coinche_matches')
        .select(`
          id,
          team1_score,
          team2_score,
          team1_player1_elo_change,
          team1_player2_elo_change,
          team2_player1_elo_change,
          team2_player2_elo_change,
          played_at,

          team1_player1:coinche_profiles!coinche_matches_team1_player1_id_fkey (
            username
          ),

          team1_player2:coinche_profiles!coinche_matches_team1_player2_id_fkey (
            username
          ),

          team2_player1:coinche_profiles!coinche_matches_team2_player1_id_fkey (
            username
          ),

          team2_player2:coinche_profiles!coinche_matches_team2_player2_id_fkey (
            username
          )
        `)
        .order('played_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement matchs coinche :', error);
        setMatchesError('Impossible de charger les matchs.');
        setMatches([]);
      } else {
        setMatches((data ?? []) as unknown as CoincheMatch[]);
        setMatchesCount(data?.length ?? 0);
      }

      setLoadingMatches(false);
    }

    async function handleAddMatch(e: React.FormEvent) {
        e.preventDefault();

        setMatchError(null);
        setMatchSuccess(null);

        const selectedPlayers = [
            team1Player1,
            team1Player2,
            team2Player1,
            team2Player2,
        ];

        if (selectedPlayers.some((id) => !id)) {
            setMatchError('Merci de choisir les quatre joueurs.');
            return;
        }

        if (new Set(selectedPlayers).size !== 4) {
            setMatchError('Les quatre joueurs doivent être différents.');
            return;
        }

        const score1 = Number(team1Score);
        const score2 = Number(team2Score);

        if (
            !Number.isInteger(score1) ||
            !Number.isInteger(score2) ||
            score1 < 0 ||
            score2 < 0
        ) {
            setMatchError('Les scores doivent être des nombres entiers positifs.');
            return;
        }

        if (score1 === score2) {
            setMatchError('Une partie ne peut pas se terminer par une égalité.');
            return;
        }

        setSavingMatch(true);

        const { data, error } = await supabase.rpc('record_coinche_match', {
            p_team1_player1_id: team1Player1,
            p_team1_player2_id: team1Player2,
            p_team2_player1_id: team2Player1,
            p_team2_player2_id: team2Player2,
            p_team1_score: score1,
            p_team2_score: score2,
        });

        if (error) {
            console.error('Erreur enregistrement match :', error);
            setMatchError(error.message || 'Impossible d’enregistrer le match.');
            setSavingMatch(false);
            return;
        }

        const result = data?.[0];

        const team1Change = Math.round(Number(result?.team1_elo_change));
        const team2Change = Math.round(Number(result?.team2_elo_change));

        setMatchSuccess(
          result
            ? `Match enregistré : équipe 1 ${
                team1Change > 0 ? '+' : ''
              }${team1Change} Elo, équipe 2 ${
                team2Change > 0 ? '+' : ''
              }${team2Change} Elo.`
            : 'Match enregistré avec succès.'
        );

        setTeam1Player1('');
        setTeam1Player2('');
        setTeam2Player1('');
        setTeam2Player2('');
        setTeam1Score('');
        setTeam2Score('');

        await Promise.all([
          loadRanking(),
          loadMatches(),
        ]);

        setSavingMatch(false);
    }

    function getMedal(rank: number) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';

        return `${rank}.`;
    }

    function formatEloChange(value: number | string) {
      const roundedValue = Math.round(Number(value));

      return roundedValue > 0
        ? `+${roundedValue}`
        : `${roundedValue}`;
    }

    function formatMatchDate(date: string) {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(date));
    }

    async function handleDeleteLastMatch() {
      if (matches.length === 0) {
        return;
      }

      const confirmed = window.confirm(
        'Supprimer le dernier match et annuler toutes ses variations Elo ?'
      );

      if (!confirmed) {
        return;
      }

      setDeletingLastMatch(true);
      setDeleteError(null);

      const { error } = await supabase.rpc('delete_last_coinche_match');

      if (error) {
        console.error('Erreur suppression dernier match :', error);
        setDeleteError(
          error.message || 'Impossible de supprimer le dernier match.'
        );
        setDeletingLastMatch(false);
        return;
      }

      await Promise.all([
        loadRanking(),
        loadMatches(),
      ]);

      setDeletingLastMatch(false);
    }

    async function loadPlayerStats(playerId: string) {
      setLoadingPlayerStats(true);
      setPlayerStatsError("");
      setPlayerStats([]);

      const { data, error } = await supabase.rpc(
        "get_coinche_player_stats",
        {
          p_player_id: playerId,
        }
      );

      if (error) {
        console.error("Erreur chargement statistiques joueur :", error);
        setPlayerStatsError(
          "Impossible de charger les statistiques de ce joueur."
        );
        setLoadingPlayerStats(false);
        return;
      }

      setPlayerStats((data ?? []) as CoinchePlayerStats[]);
      setLoadingPlayerStats(false);
    }

    const sortedPlayerStats = [...playerStats].sort((a, b) => {
      if (playerStatsSort === "matches") {
        return (
          Number(b.total_matches) - Number(a.total_matches) ||
          a.other_player_username.localeCompare(
            b.other_player_username,
            "fr",
            { sensitivity: "base" }
          )
        );
      }

      if (playerStatsSort === "elo") {
        return (
          Number(b.total_elo_points) - Number(a.total_elo_points) ||
          a.other_player_username.localeCompare(
            b.other_player_username,
            "fr",
            { sensitivity: "base" }
          )
        );
      }

      return a.other_player_username.localeCompare(
        b.other_player_username,
        "fr",
        { sensitivity: "base" }
      );
    });

    async function loadPlayerEloHistory(playerId: string) {
      setLoadingEloHistory(true);
      setEloHistory([]);

      const { data, error } = await supabase
        .from("coinche_matches")
        .select(`
          id,
          played_at,

          team1_player1_id,
          team1_player2_id,
          team2_player1_id,
          team2_player2_id,

          team1_player1_elo_before,
          team1_player2_elo_before,
          team2_player1_elo_before,
          team2_player2_elo_before,

          team1_player1_elo_change,
          team1_player2_elo_change,
          team2_player1_elo_change,
          team2_player2_elo_change
        `)
        .or(
          `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`
        )
        .order("played_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.error("Erreur historique Elo :", error);
        setLoadingEloHistory(false);
        return;
      }

      const history: EloHistoryPoint[] = [
        {
          match: 0,
          elo: 1000,
          date: "Départ",
        },
      ];

      (data ?? []).forEach((coincheMatch, index) => {
        let eloBefore = 1000;
        let eloChange = 0;

        if (coincheMatch.team1_player1_id === playerId) {
          eloBefore = Number(coincheMatch.team1_player1_elo_before);
          eloChange = Number(coincheMatch.team1_player1_elo_change);
        } else if (coincheMatch.team1_player2_id === playerId) {
          eloBefore = Number(coincheMatch.team1_player2_elo_before);
          eloChange = Number(coincheMatch.team1_player2_elo_change);
        } else if (coincheMatch.team2_player1_id === playerId) {
          eloBefore = Number(coincheMatch.team2_player1_elo_before);
          eloChange = Number(coincheMatch.team2_player1_elo_change);
        } else if (coincheMatch.team2_player2_id === playerId) {
          eloBefore = Number(coincheMatch.team2_player2_elo_before);
          eloChange = Number(coincheMatch.team2_player2_elo_change);
        }

        history.push({
          match: index + 1,
          elo: Math.round(eloBefore + eloChange),
          date: new Date(coincheMatch.played_at).toLocaleDateString("fr-FR"),
        });
      });

      console.log("Historique Elo :", history);

      setEloHistory(history);
      setLoadingEloHistory(false);
    }

    return (
        <main className="min-h-screen bg-gray-100 px-3 py-4">
            <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-md">
                <header className="bg-green-700 px-4 py-5 text-center text-white">
                    <h1 className="text-2xl font-bold">Tournoi de coinche</h1>
                    <p className="mt-1 text-sm text-green-100">
                        Points Elo
                    </p>
                </header>

                <nav className="grid grid-cols-3 border-b bg-white">
                    <button
                        type="button"
                        onClick={() => setActiveTab('matches')}
                        className={`px-2 py-3 text-sm font-semibold transition ${activeTab === 'matches'
                                ? 'border-b-4 border-green-700 text-green-800'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        Matchs
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ranking')}
                        className={`px-2 py-3 text-sm font-semibold transition ${activeTab === 'ranking'
                                ? 'border-b-4 border-green-700 text-green-800'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        Classement
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('add')}
                        className={`px-2 py-3 text-sm font-semibold transition ${activeTab === 'add'
                                ? 'border-b-4 border-green-700 text-green-800'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`}
                    >
                        Saisir
                    </button>
                </nav>

                <section className="p-4">
                    {activeTab === 'matches' && (
                      <div>
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <h2 className="text-xl font-bold text-gray-900">
                            Matchs joués ({matchesCount})
                          </h2>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={loadMatches}
                              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                            >
                              Actualiser
                            </button>

                            <button
                              type="button"
                              onClick={handleDeleteLastMatch}
                              disabled={matches.length === 0 || deletingLastMatch}
                              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deletingLastMatch ? 'Suppression...' : 'Annuler le dernier'}
                            </button>
                          </div>
                        </div>

                        {deleteError && (
                          <p className="mb-3 rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                            {deleteError}
                          </p>
                        )}

                        {loadingMatches && (
                          <p className="py-8 text-center text-gray-500">
                            Chargement des matchs...
                          </p>
                        )}

                        {!loadingMatches && matchesError && (
                          <p className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                            {matchesError}
                          </p>
                        )}

                        {!loadingMatches && !matchesError && matches.length === 0 && (
                          <p className="py-8 text-center text-gray-500">
                            Aucun match joué pour le moment.
                          </p>
                        )}

                        {!loadingMatches && !matchesError && matches.length > 0 && (
                          <div className="space-y-3">
                            {matches.map((match) => {
                              const team1Won = match.team1_score > match.team2_score;
                              const team2Won = match.team2_score > match.team1_score;

                              return (
                                <article
                                  key={match.id}
                                  className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                                >
                                  <div className="bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                                    {formatMatchDate(match.played_at)}
                                  </div>

                                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-4">
                                    <div
                                      className={`text-center ${
                                        team1Won ? 'font-bold text-green-800' : 'text-gray-700'
                                      }`}
                                    >
                                      <p>{match.team1_player1?.username ?? 'Joueur inconnu'}</p>
                                      <p>{match.team1_player2?.username ?? 'Joueur inconnu'}</p>

                                      <p
                                        className={`mt-2 text-sm font-bold ${
                                          match.team1_player1_elo_change > 0
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {formatEloChange(match.team1_player1_elo_change)} Elo
                                      </p>
                                    </div>

                                    <div className="text-center">
                                      <div className="whitespace-nowrap text-2xl font-black text-gray-900">
                                        {match.team1_score}
                                        <span className="mx-2 text-gray-400">-</span>
                                        {match.team2_score}
                                      </div>

                                      <p className="mt-1 text-xs font-semibold uppercase text-gray-400">
                                        Score final
                                      </p>
                                    </div>

                                    <div
                                      className={`text-center ${
                                        team2Won ? 'font-bold text-green-800' : 'text-gray-700'
                                      }`}
                                    >
                                      <p>{match.team2_player1?.username ?? 'Joueur inconnu'}</p>
                                      <p>{match.team2_player2?.username ?? 'Joueur inconnu'}</p>

                                      <p
                                        className={`mt-2 text-sm font-bold ${
                                          match.team2_player1_elo_change > 0
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                        }`}
                                      >
                                        {formatEloChange(match.team2_player1_elo_change)} Elo
                                      </p>
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'add' && (
                        <form onSubmit={handleAddMatch} className="space-y-5">
                            <h2 className="text-xl font-bold text-gray-900">
                                Saisir un match
                            </h2>

                            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                                <h3 className="mb-3 text-center font-bold text-green-800">
                                    Équipe 1
                                </h3>

                                <div className="space-y-3">
                                    <select
                                        value={team1Player1}
                                        onChange={(e) => setTeam1Player1(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3"
                                    >
                                        <option value="">Joueur 1</option>
                                        {playersForSelect.map((player) => (
                                            <option key={player.id} value={player.id}>
                                                {player.username} — {Math.round(Number(player.elo))}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={team1Player2}
                                        onChange={(e) => setTeam1Player2(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3"
                                    >
                                        <option value="">Joueur 2</option>
                                        {playersForSelect.map((player) => (
                                            <option key={player.id} value={player.id}>
                                                {player.username} — {Math.round(Number(player.elo))}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="Score équipe 1"
                                        value={team1Score}
                                        onChange={(e) => setTeam1Score(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-center text-lg font-bold"
                                    />
                                </div>
                            </div>

                            <div className="text-center text-sm font-bold text-gray-400">
                                CONTRE
                            </div>

                            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                <h3 className="mb-3 text-center font-bold text-orange-800">
                                    Équipe 2
                                </h3>

                                <div className="space-y-3">
                                    <select
                                        value={team2Player1}
                                        onChange={(e) => setTeam2Player1(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3"
                                    >
                                        <option value="">Joueur 1</option>
                                        {playersForSelect.map((player) => (
                                            <option key={player.id} value={player.id}>
                                                {player.username} — {Math.round(Number(player.elo))}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={team2Player2}
                                        onChange={(e) => setTeam2Player2(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3"
                                    >
                                        <option value="">Joueur 2</option>
                                        {playersForSelect.map((player) => (
                                            <option key={player.id} value={player.id}>
                                                {player.username} — {Math.round(Number(player.elo))}
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="Score équipe 2"
                                        value={team2Score}
                                        onChange={(e) => setTeam2Score(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-center text-lg font-bold"
                                    />
                                </div>
                            </div>

                            {matchError && (
                                <p className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                                    {matchError}
                                </p>
                            )}

                            {matchSuccess && (
                                <p className="rounded-lg bg-green-50 px-3 py-3 text-center text-sm font-semibold text-green-700">
                                    {matchSuccess}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={savingMatch}
                                className="w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {savingMatch ? 'Enregistrement...' : 'Enregistrer le match'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'ranking' && (
                        <div>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900">
                                    Classement général
                                </h2>

                                <button
                                    type="button"
                                    onClick={loadRanking}
                                    className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                                >
                                    Actualiser
                                </button>
                            </div>

                            {loading && (
                                <p className="py-8 text-center text-gray-500">
                                    Chargement du classement...
                                </p>
                            )}

                            {!loading && errorMsg && (
                                <p className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                                    {errorMsg}
                                </p>
                            )}

                            {!loading && !errorMsg && players.length === 0 && (
                                <p className="py-8 text-center text-gray-500">
                                    Aucun joueur enregistré.
                                </p>
                            )}

                            {!loading && !errorMsg && players.length > 0 && (
                                <div className="space-y-2">
                                  {players.map((player, index) => {
                                    const rank = index + 1;

                                    return (
                                      <button
                                        key={player.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedPlayer(player);
                                          setPlayerStatsOpen(true);
                                          loadPlayerStats(player.id);
                                          loadPlayerEloHistory(player.id);
                                        }}
                                        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:border-gray-300 hover:bg-gray-50"
                                      >
                                        <div className="w-10 shrink-0 text-center text-lg font-bold">
                                          {getMedal(rank)}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <p className="truncate font-bold text-gray-900">
                                            {player.username}
                                          </p>

                                          <p className="text-xs text-gray-500">
                                            {player.matches_played} partie
                                            {player.matches_played > 1 ? 's' : ''} ·{' '}
                                            {player.wins} V · {player.losses} D
                                          </p>
                                        </div>

                                        <div className="text-right">
                                          <p className="text-xl font-bold text-green-700">
                                            {Math.round(Number(player.elo))}
                                          </p>
                                          <p className="text-xs text-gray-500">Elo</p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* POP UP Stats */}
            {playerStatsOpen && selectedPlayer && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                  
                  {/* En-tête toujours visible */}
                  <div className="relative shrink-0 border-b border-gray-200 px-5 py-4">
                    <button
                      type="button"
                        onClick={() => {
                          setPlayerStatsOpen(false);
                          setSelectedPlayer(null);

                          setPlayerStats([]);
                          setPlayerStatsError("");

                          setEloHistory([]);
                          setLoadingEloHistory(false);
                        }}
                      className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-700 hover:bg-gray-200"
                      aria-label="Fermer"
                    >
                      ×
                    </button>

                    <h2 className="pr-12 text-2xl font-bold text-gray-900">
                      Statistiques de {selectedPlayer.username}
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Elo actuel : {Math.round(Number(selectedPlayer.elo))}
                    </p>
                  </div>

                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      Trier par

                      <select
                        value={playerStatsSort}
                        onChange={(e) =>
                          setPlayerStatsSort(e.target.value as PlayerStatsSort)
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-green-500"
                      >
                        <option value="alphabetical">Ordre alphabétique</option>
                        <option value="matches">Nombre de matchs</option>
                        <option value="elo">Points Elo</option>
                      </select>
                    </label>
                  </div>

                  {/* Contenu défilable */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">

                    {/* Graphique */}
                    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-3">
                      <h3 className="mb-3 text-center text-base font-bold text-gray-900">
                        Évolution des points Elo
                      </h3>

                      {loadingEloHistory && (
                        <p className="py-8 text-center text-sm text-gray-500">
                          Chargement du graphique...
                        </p>
                      )}

                      {!loadingEloHistory && eloHistory.length > 1 && (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={eloHistory}
                              margin={{
                                top: 10,
                                right: 15,
                                left: 0,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />

                              <XAxis
                                dataKey="match"
                                tick={{ fontSize: 12 }}
                                label={{
                                  value: "Match",
                                  position: "insideBottom",
                                  offset: -2,
                                }}
                              />

                              <YAxis
                                domain={["dataMin - 20", "dataMax + 20"]}
                                tick={{ fontSize: 12 }}
                                width={45}
                              />

                              <Tooltip
                                formatter={(value) => [
                                  `${Math.round(Number(value))} Elo`,
                                  "Points Elo",
                                ]}
                                labelFormatter={(matchNumber) => {
                                  const point = eloHistory.find(
                                    (item) => item.match === Number(matchNumber)
                                  );

                                  if (Number(matchNumber) === 0) {
                                    return "Départ";
                                  }

                                  return `Match ${matchNumber} · ${point?.date ?? ""}`;
                                }}
                              />

                              <Line
                                type="monotone"
                                dataKey="elo"
                                stroke="#15803d"
                                strokeWidth={3}
                                dot={{ r: 3 }}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {!loadingEloHistory && eloHistory.length <= 1 && (
                        <p className="py-8 text-center text-sm text-gray-500">
                          Pas encore assez de matchs pour afficher une évolution.
                        </p>
                      )}
                    </div>
                    
                    {loadingPlayerStats && (
                      <p className="py-8 text-center text-gray-500">
                        Chargement des statistiques...
                      </p>
                    )}

                    {!loadingPlayerStats && playerStatsError && (
                      <p className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                        {playerStatsError}
                      </p>
                    )}

                    {!loadingPlayerStats &&
                      !playerStatsError &&
                      playerStats.length === 0 && (
                        <p className="py-8 text-center text-gray-500">
                          Aucune statistique disponible.
                        </p>
                      )}

                    {!loadingPlayerStats &&
                      !playerStatsError &&
                      playerStats.length > 0 && (
                      <div className="space-y-2">
                        {/* En-tête du tableau */}
                        <div className="grid grid-cols-[1fr_110px_1fr] items-center gap-2 px-2 text-center text-xs font-bold uppercase tracking-wide text-gray-500">
                          <div>Avec</div>
                          <div>Joueur</div>
                          <div>Contre</div>
                        </div>

                        {sortedPlayerStats.map((stat) => {
                          const withElo = Math.round(Number(stat.with_elo_points));
                          const againstElo = Math.round(Number(stat.against_elo_points));

                          return (
                            <div
                              key={stat.other_player_id}
                              className="grid grid-cols-[1fr_110px_1fr] items-stretch gap-2 rounded-xl border border-gray-200 bg-white p-2"
                            >
                              {/* Avec */}
                              <div className="flex min-w-0 flex-col justify-center rounded-lg bg-green-50 px-2 py-3 text-center">
                                <p className="text-lg font-bold text-gray-900">
                                  {stat.with_matches}
                                </p>

                                <p className="text-xs text-gray-500">
                                  match{stat.with_matches > 1 ? "s" : ""}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-gray-700">
                                  {stat.with_wins} V · {stat.with_losses} D
                                </p>

                                <p
                                  className={`mt-1 text-sm font-bold ${
                                    withElo > 0
                                      ? "text-green-700"
                                      : withElo < 0
                                      ? "text-red-600"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {withElo > 0 ? "+" : ""}
                                  {withElo} Elo
                                </p>
                              </div>

                              {/* Joueur central */}
                              <div className="flex min-w-0 flex-col items-center justify-center text-center">
                                <p className="w-full truncate text-sm font-bold text-gray-900">
                                  {stat.other_player_username}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {stat.total_matches} match
                                  {stat.total_matches > 1 ? "s" : ""}
                                </p>

                                <p
                                  className={`mt-1 text-xs font-bold ${
                                    Number(stat.total_elo_points) > 0
                                      ? "text-green-700"
                                      : Number(stat.total_elo_points) < 0
                                      ? "text-red-600"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {Math.round(Number(stat.total_elo_points)) > 0
                                    ? "+"
                                    : ""}
                                  {Math.round(Number(stat.total_elo_points))} Elo
                                </p>
                              </div>

                              {/* Contre */}
                              <div className="flex min-w-0 flex-col justify-center rounded-lg bg-orange-50 px-2 py-3 text-center">
                                <p className="text-lg font-bold text-gray-900">
                                  {stat.against_matches}
                                </p>

                                <p className="text-xs text-gray-500">
                                  match{stat.against_matches > 1 ? "s" : ""}
                                </p>

                                <p className="mt-1 text-sm font-semibold text-gray-700">
                                  {stat.against_wins} V · {stat.against_losses} D
                                </p>

                                <p
                                  className={`mt-1 text-sm font-bold ${
                                    againstElo > 0
                                      ? "text-green-700"
                                      : againstElo < 0
                                      ? "text-red-600"
                                      : "text-gray-500"
                                  }`}
                                >
                                  {againstElo > 0 ? "+" : ""}
                                  {againstElo} Elo
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      )}
                  </div>

                </div>
              </div>
            )}
        </main>
    );
}