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

export default function AdminBoostPanel() {
  const supabase = useSupabase();

  const BOOST_3_ID = 'b432ea6b-b196-46c2-b00c-577f89d15778';
  const BOOST_2_ID = '02040012-e79d-4b66-bb39-76f5025894f3';
  const BOOST_1_ID = 'e0bc5870-6b77-40ec-876a-ef0a14140f36';

  const [saving, setSaving] = useState(false);
  const [gridBoostDone, setGridBoostDone] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [grids, setGrids] = useState<GridRow[]>([]);

  const [selectedCompId, setSelectedCompId] = useState('');
  const [selectedGridId, setSelectedGridId] = useState('');

  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  const [boost3ByUser, setBoost3ByUser] = useState<Record<string, boolean>>({});
  const [boost2ByUser, setBoost2ByUser] = useState<Record<string, boolean>>({});
  const [boost1ByUser, setBoost1ByUser] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadCompetitions = async () => {
      setLoading(true);
      setMessage(null);

      try {
        const { data, error } = await supabase
          .from('competitions')
          .select('id,name,created_at,mode')
          .eq('kind', 'PUBLIC')
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
      setGridBoostDone({});

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
  const { data: boostRows, error: boostErr } = await supabase
    .from('bonus_admin_boost')
    .select('grid_id')
    .in('grid_id', gridIds);

  if (boostErr) throw new Error(boostErr.message);

  const doneMap: Record<string, boolean> = {};
  (boostRows || []).forEach((row: any) => {
    if (row.grid_id) doneMap[row.grid_id] = true;
  });

  setGridBoostDone(doneMap);
}
      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement grilles'));
      } finally {
        setLoading(false);
      }
    };

    loadGrids();
  }, [supabase, selectedCompId]);

  useEffect(() => {
    setLeaderboard([]);
    setBoost3ByUser({});
    setBoost2ByUser({});
    setBoost1ByUser({});
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

    setLoadingBoard(true);
    setMessage(null);
    setLeaderboard([]);
    setBoost3ByUser({});
    setBoost2ByUser({});
    setBoost1ByUser({});

    try {
      const { data, error } = await supabase.rpc('get_leaderboard_by_grid', {
        p_grid_id: selectedGridId,
      });

      if (error) throw new Error(error.message);

      setLeaderboard((data || []) as LeaderRow[]);
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur chargement classement'));
    } finally {
      setLoadingBoard(false);
    }
  };

  const toggleBoost3 = (userId: string) => {
    setBoost3ByUser(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const toggleBoost2 = (userId: string) => {
    setBoost2ByUser(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const toggleBoost1 = (userId: string) => {
    setBoost1ByUser(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const countBoost3 = Object.values(boost3ByUser).filter(Boolean).length;
  const countBoost2 = Object.values(boost2ByUser).filter(Boolean).length;
  const countBoost1 = Object.values(boost1ByUser).filter(Boolean).length;

const validateBoosts = async () => {
  setMessage(null);

  if (!selectedCompId) {
    setMessage('❌ Choisis une compétition.');
    return;
  }

  if (!selectedGridId) {
    setMessage('❌ Choisis une grille.');
    return;
  }

  const adminRows: {
    competition_id: string;
    grid_id: string;
    user_id: string;
    bonus_definition: string;
    quantity: number;
  }[] = [];

  Object.entries(boost3ByUser).forEach(([userId, checked]) => {
    if (checked) {
      adminRows.push({
        competition_id: selectedCompId,
        grid_id: selectedGridId,
        user_id: userId,
        bonus_definition: BOOST_3_ID,
        quantity: 1,
      });
    }
  });

  Object.entries(boost2ByUser).forEach(([userId, checked]) => {
    if (checked) {
      adminRows.push({
        competition_id: selectedCompId,
        grid_id: selectedGridId,
        user_id: userId,
        bonus_definition: BOOST_2_ID,
        quantity: 1,
      });
    }
  });

  Object.entries(boost1ByUser).forEach(([userId, checked]) => {
    if (checked) {
      adminRows.push({
        competition_id: selectedCompId,
        grid_id: selectedGridId,
        user_id: userId,
        bonus_definition: BOOST_1_ID,
        quantity: 1,
      });
    }
  });

  if (adminRows.length === 0) {
    setMessage('❌ Aucun boost sélectionné.');
    return;
  }

  setSaving(true);

  try {
    // 1) Historique admin par grille
    const { error: adminErr } = await supabase
      .from('bonus_admin_boost')
      .insert(adminRows);

    if (adminErr) throw new Error(adminErr.message);

    // 2) Agréger par joueur + bonus pour alimenter bonus_inventory
    const grouped: Record<
      string,
      {
        competition_id: string;
        user_id: string;
        bonus_definition: string;
        quantity: number;
      }
    > = {};

    adminRows.forEach((row) => {
      const key = `${row.competition_id}__${row.user_id}__${row.bonus_definition}`;

      if (!grouped[key]) {
        grouped[key] = {
          competition_id: row.competition_id,
          user_id: row.user_id,
          bonus_definition: row.bonus_definition,
          quantity: 0,
        };
      }

      grouped[key].quantity += row.quantity;
    });

    const groupedRows = Object.values(grouped);

    for (const row of groupedRows) {
      const { error } = await supabase.rpc('add_bonus_inventory', {
        p_user_id: row.user_id,
        p_competition_id: row.competition_id,
        p_bonus_definition: row.bonus_definition,
        p_quantity: row.quantity,
      });

      if (error) throw new Error(error.message);
    }

    setMessage(`✅ ${adminRows.length} attribution(s) enregistrée(s).`);
    setGridBoostDone(prev => ({ ...prev, [selectedGridId]: true }));

    // reset cases
    setBoost3ByUser({});
    setBoost2ByUser({});
    setBoost1ByUser({});
  } catch (e: any) {
    setMessage('❌ ' + (e?.message || 'Erreur attribution boosts'));
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Boosts</h2>

      {message && (
        <div className="p-3 rounded bg-red-100 text-red-800">
          {message}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="block mb-1 font-medium">Compétition</label>
          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={loading}
          >
            <option value="">— Choisir —</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.mode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Grille</label>
          <select
            value={selectedGridId}
            onChange={(e) => setSelectedGridId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={loading || !selectedCompId}
          >
            <option value="">— Choisir —</option>
{grids.map((g) => (
  <option key={g.id} value={g.id}>
    {gridBoostDone[g.id] ? '✅ ' : '🕒 '}
    {g.title}{g.grid_done ? '' : ' (non terminée)'}
  </option>
))}
          </select>
        </div>

        <div>
          <button
            onClick={loadLeaderboard}
            disabled={loading || loadingBoard || saving || !selectedGridId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingBoard ? 'Chargement…' : 'Charger le classement'}
          </button>
        </div>
      </div>

      <div className="border rounded p-4 bg-gray-50 text-sm text-gray-700 space-y-1">
        <div>
          <span className="font-medium">Compétition choisie :</span>{' '}
          {selectedCompetition ? selectedCompetition.name : '—'}
        </div>
        <div>
          <span className="font-medium">Grille choisie :</span>{' '}
          {selectedGrid ? selectedGrid.title : '—'}
        </div>
      </div>

      <div className="border rounded">
        <div className="p-3 border-b font-medium">Classement de la grille</div>

        {leaderboard.length === 0 ? (
          <div className="p-3 text-gray-600">
            {loadingBoard ? 'Chargement…' : 'Charge un classement pour afficher les joueurs.'}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Pseudo</th>
                  <th className="text-left p-2">Points</th>
                  <th className="text-center p-2">Boost +3</th>
                  <th className="text-center p-2">Boost +2</th>
                  <th className="text-center p-2">Boost +1</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="p-2">{r.rank}</td>
                    <td className="p-2">{r.username}</td>
                    <td className="p-2">{r.total_points}</td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!boost3ByUser[r.user_id]}
                        onChange={() => toggleBoost3(r.user_id)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!boost2ByUser[r.user_id]}
                        onChange={() => toggleBoost2(r.user_id)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!boost1ByUser[r.user_id]}
                        onChange={() => toggleBoost1(r.user_id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <div>Boost +3 cochés : <span className="font-semibold">{countBoost3}</span></div>
        <div>Boost +2 cochés : <span className="font-semibold">{countBoost2}</span></div>
        <div>Boost +1 cochés : <span className="font-semibold">{countBoost1}</span></div>
      </div>
<div>
  <button
    onClick={validateBoosts}
    disabled={saving}
    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
  >
    {saving ? 'Validation…' : 'Valider les boosts'}
  </button>
</div>
    </div>
  );
}