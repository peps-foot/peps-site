'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabase } from './SupabaseProvider';

type CompetitionRow = {
  id: string;
  name: string;
  created_at?: string;
  mode: 'CLASSIC' | 'TOURNOI';
};

type GridRow = {
  id: string;
  title: string;
  created_at?: string;
  competition_id: string | null;
  grid_done: boolean | null;
};

type LeaderRow = {
  user_id: string;
  username: string;
  total_points: number;
  rank: number;
};

type NonParticipantRow = {
  user_id: string;
  username: string;
};

export default function AdminEliminationsPanel() {
  const supabase = useSupabase();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [grids, setGrids] = useState<GridRow[]>([]);

  const [selectedCompId, setSelectedCompId] = useState('');
  const [selectedGridId, setSelectedGridId] = useState('');
  const [gridElimDone, setGridElimDone] = useState<Record<string, boolean>>({});

  const [loadingBoard, setLoadingBoard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [nonParticipants, setNonParticipants] = useState<NonParticipantRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});

  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCompetitions = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const { data, error } = await supabase
          .from('competitions')
          .select('id,name,created_at,mode')
          .eq('mode', 'TOURNOI')
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        setCompetitions((data || []) as CompetitionRow[]);
      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement compétitions'));
      } finally {
        setLoading(false);
      }
    };

    loadCompetitions();
  }, [supabase]);

  useEffect(() => {
    const loadGrids = async () => {
      setSelectedGridId('');
      setGrids([]);
      setGridElimDone({});

      if (!selectedCompId) return;

      setLoading(true);
      setMessage(null);

      try {
        const { data, error } = await supabase
          .from('grids')
          .select('id,title,created_at,competition_id,grid_done')
          .eq('competition_id', selectedCompId)
          .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        setGrids((data || []) as GridRow[]);
        const gridIds = (data || []).map(g => g.id);

        if (gridIds.length > 0) {
          const { data: elimRows, error: elimErr } = await supabase
            .from('grid_player_eligibility')
            .select('grid_id')
            .in('grid_id', gridIds);

          if (elimErr) throw new Error(elimErr.message);

          const doneMap: Record<string, boolean> = {};

          (elimRows || []).forEach((row: any) => {
            if (row.grid_id) doneMap[row.grid_id] = true;
          });

          setGridElimDone(doneMap);
        }
      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement grilles'));
      } finally {
        setLoading(false);
      }
    };

    loadGrids();
  }, [supabase, selectedCompId]);

  // Réinitialise le classement quand on change de compétition ou de grille
  useEffect(() => {
    setLeaderboard([]);
    setNonParticipants([]);
    setSelectedUserIds({});
    setMessage(null);
  }, [selectedCompId, selectedGridId]);

  const selectedCompetition = useMemo(
    () => competitions.find(c => c.id === selectedCompId) || null,
    [competitions, selectedCompId]
  );

  const selectedGrid = useMemo(
    () => grids.find(g => g.id === selectedGridId) || null,
    [grids, selectedGridId]
  );

  const loadLeaderboard = async () => {
    if (!selectedGridId) {
      setMessage('❌ Choisis une grille.');
      return;
    }

    if (!selectedCompId) {
      setMessage('❌ Choisis une compétition.');
      return;
    }

    setLoadingBoard(true);
    setMessage(null);
    setLeaderboard([]);
    setNonParticipants([]);
    setSelectedUserIds({});

    try {
      // ---------------------------------------------------------
      // 1. Classement normal : ON NE TOUCHE PAS À LA RPC
      // ---------------------------------------------------------
      const { data: leaderboardData, error: leaderboardError } =
        await supabase.rpc('get_leaderboard_by_grid', {
          p_grid_id: selectedGridId,
        });

      if (leaderboardError) {
        throw new Error(leaderboardError.message);
      }

      const currentLeaderboard =
        (leaderboardData || []) as LeaderRow[];

      setLeaderboard(currentLeaderboard);

      // ---------------------------------------------------------
      // 2. Récupération des membres de la compétition
      // ---------------------------------------------------------
      const { data: memberRows, error: membersError } = await supabase
        .from('competition_members')
        .select('user_id')
        .eq('competition_id', selectedCompId)
        .eq('role', 'PLAYER');

      if (membersError) {
        throw new Error(membersError.message);
      }

      const memberIds = (memberRows || []).map(row => row.user_id);

      if (memberIds.length === 0) {
        setNonParticipants([]);
        return;
      }

      // ---------------------------------------------------------
      // 3. Récupération des joueurs déjà éliminés
      // ---------------------------------------------------------
      const { data: eligibilityRows, error: eligibilityError } =
        await supabase
          .from('grid_player_eligibility')
          .select('user_id')
          .eq('competition_id', selectedCompId)
          .in('user_id', memberIds);

      if (eligibilityError) {
        throw new Error(eligibilityError.message);
      }

      const eliminatedIds = new Set(
        (eligibilityRows || []).map(row => row.user_id)
      );

      // ---------------------------------------------------------
      // 4. Joueurs ayant fait au moins une CROIX sur cette grille
      // ---------------------------------------------------------
      const { data: pickRows, error: picksError } = await supabase
        .from('grid_matches')
        .select('user_id')
        .eq('grid_id', selectedGridId)
        .not('pick', 'is', null)
        .in('user_id', memberIds);

      if (picksError) {
        throw new Error(picksError.message);
      }

      // ---------------------------------------------------------
      // 5. Joueurs ayant utilisé au moins un BONUS
      // ---------------------------------------------------------
      const { data: bonusRows, error: bonusError } = await supabase
        .from('grid_bonus')
        .select('user_id')
        .eq('grid_id', selectedGridId)
        .in('user_id', memberIds);

      if (bonusError) {
        throw new Error(bonusError.message);
      }

      // ---------------------------------------------------------
      // 6. Un joueur est considéré comme ayant joué s'il a :
      //    - au moins une croix
      //    OU
      //    - au moins un bonus
      // ---------------------------------------------------------
      const playedIds = new Set<string>();

      (pickRows || []).forEach(row => {
        playedIds.add(row.user_id);
      });

      (bonusRows || []).forEach(row => {
        playedIds.add(row.user_id);
      });

      // ---------------------------------------------------------
      // 7. Joueurs à afficher dans "n'ont pas joué"
      //
      //    membre de la compétition
      //    + pas déjà éliminé
      //    + aucune croix
      //    + aucun bonus
      // ---------------------------------------------------------
      const nonParticipantIds = memberIds.filter(userId =>
        !eliminatedIds.has(userId) &&
        !playedIds.has(userId)
      );

      if (nonParticipantIds.length === 0) {
        setNonParticipants([]);
        return;
      }

      // ---------------------------------------------------------
      // 8. Récupération des pseudos
      // ---------------------------------------------------------
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id,username')
        .in('user_id', nonParticipantIds);

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      const profilesMap = new Map(
        (profileRows || []).map(row => [
          row.user_id,
          row.username || 'Pseudo inconnu',
        ])
      );

      const nonParticipantList: NonParticipantRow[] =
        nonParticipantIds.map(userId => ({
          user_id: userId,
          username: profilesMap.get(userId) || 'Pseudo inconnu',
        }));

      // Tri alphabétique des pseudos
      nonParticipantList.sort((a, b) =>
        a.username.localeCompare(b.username)
      );

      setNonParticipants(nonParticipantList);

    } catch (e: any) {
      setMessage(
        '❌ ' + (e?.message || 'Erreur chargement classement')
      );
    } finally {
      setLoadingBoard(false);
    }
  };

  // Pour cocher ou décocher
  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Pour valider les éliminés
  const validateEliminations = async () => {
    setMessage(null);

    if (!selectedCompId) {
      setMessage('❌ Choisis une compétition.');
      return;
    }

    if (!selectedGridId) {
      setMessage('❌ Choisis une grille.');
      return;
    }

    const selectedUsers = Object.entries(selectedUserIds)
      .filter(([_, checked]) => checked)
      .map(([userId]) => userId);

    if (selectedUsers.length === 0) {
      setMessage('❌ Aucun joueur sélectionné.');
      return;
    }

    if (!reason.trim()) {
      setMessage("❌ Renseigne un motif.");
      return;
    }

    setSaving(true);

    try {
      const rows = selectedUsers.map((userId) => ({
        competition_id: selectedCompId,
        grid_id: selectedGridId,
        user_id: userId,
        can_play: false,
        reason: reason,
      }));

      const { error } = await supabase
        .from('grid_player_eligibility')
        .insert(rows);

      if (error) throw new Error(error.message);

      setMessage(`✅ ${rows.length} joueur(s) éliminé(s).`);
      setGridElimDone(prev => ({
        ...prev,
        [selectedGridId]: true,
      }));

      // On retire les joueurs nouvellement éliminés de la liste
      setLeaderboard(prev =>
        prev.filter(r => !selectedUserIds[r.user_id])
      );

      setNonParticipants(prev =>
        prev.filter(r => !selectedUserIds[r.user_id])
      );

      setSelectedUserIds({});
      setReason('');

    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur insertion'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Éliminations</h2>

      {message && (
        <div className="p-3 rounded bg-red-100 text-red-800">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="block mb-1 font-medium">
            Compétition TOURNOI
          </label>

          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={loading}
          >
            <option value="">— Choisir —</option>

            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">
            Grille
          </label>

          <select
            value={selectedGridId}
            onChange={(e) => setSelectedGridId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={loading || !selectedCompId}
          >
            <option value="">— Choisir —</option>

            {grids.map((g) => (
              <option key={g.id} value={g.id}>
                {gridElimDone[g.id] ? '✅ ' : '🕒 '}
                {g.title}
                {g.grid_done ? '' : ' (non terminée)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={loadLeaderboard}
            disabled={loading || loadingBoard || !selectedGridId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingBoard ? 'Chargement…' : 'Charger le classement'}
          </button>
        </div>
      </div>

      <div className="border rounded p-4 bg-gray-50 text-sm text-gray-700 space-y-1">
        <div>
          <span className="font-medium">
            Compétition choisie :
          </span>{' '}
          {selectedCompetition
            ? selectedCompetition.name
            : '—'}
        </div>

        <div>
          <span className="font-medium">
            Grille choisie :
          </span>{' '}
          {selectedGrid
            ? selectedGrid.title
            : '—'}
        </div>
      </div>

      {/* ======================================================
          CLASSEMENT NORMAL
          ====================================================== */}

      <div className="border rounded">
        <div className="p-3 border-b font-medium">
          Classement de la grille
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-3 text-gray-600">
            {loadingBoard
              ? 'Chargement…'
              : 'Charge un classement pour afficher les joueurs.'}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Choix</th>
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Pseudo</th>
                  <th className="text-left p-2">Points</th>
                </tr>
              </thead>

              <tbody>
                {leaderboard.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-t"
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={!!selectedUserIds[r.user_id]}
                        onChange={() => toggleUser(r.user_id)}
                      />
                    </td>

                    <td className="p-2">
                      {r.rank}
                    </td>

                    <td className="p-2">
                      {r.username}
                    </td>

                    <td className="p-2">
                      {r.total_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================
          JOUEURS INSCRITS MAIS N'AYANT PAS JOUÉ
          ====================================================== */}

      {nonParticipants.length > 0 && (
        <div className="border border-orange-300 rounded">
          <div className="p-3 border-b border-orange-300 bg-orange-50 font-medium text-orange-800">
            ⚠️ Inscrits n'ayant pas joué cette grille
          </div>

          <div className="p-3 text-sm text-gray-600">
            Ces joueurs sont inscrits à la compétition mais n'ont
            fait ni croix ni bonus sur cette grille.
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-50">
                <tr>
                  <th className="text-left p-2">Choix</th>
                  <th className="text-left p-2">Pseudo</th>
                </tr>
              </thead>

              <tbody>
                {nonParticipants.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-t"
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={!!selectedUserIds[r.user_id]}
                        onChange={() => toggleUser(r.user_id)}
                      />
                    </td>

                    <td className="p-2">
                      {r.username}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-600">
        Joueurs cochés :{' '}
        <span className="font-semibold">
          {Object.values(selectedUserIds).filter(Boolean).length}
        </span>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div>
          <label className="block mb-1 font-medium">
            Motif d'élimination
          </label>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Ex : éliminé après cette grille"
          />
        </div>

        <button
          onClick={validateEliminations}
          disabled={saving}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {saving
            ? 'Validation…'
            : 'Valider les éliminations'}
        </button>
      </div>
    </div>
  );
}