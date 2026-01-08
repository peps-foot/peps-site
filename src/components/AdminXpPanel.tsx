'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabase } from './SupabaseProvider';

type Mode = 'grid' | 'comp' | 'tournament';

type CompetitionRow = {
  id: string;
  name: string;
  created_at?: string;
  xp_enabled: boolean;
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

export default function AdminXpPanel() {
  const supabase = useSupabase();

  const [mode, setMode] = useState<Mode>('grid');
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [grids, setGrids] = useState<GridRow[]>([]);

  // ✅ statut "déjà attribué"
  const [gridXpDone, setGridXpDone] = useState<Record<string, boolean>>({});
  const [compXpDone, setCompXpDone] = useState<Record<string, boolean>>({});

  const [selectedGridId, setSelectedGridId] = useState<string>('');
  const [selectedCompId, setSelectedCompId] = useState<string>('');

  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [xpByUser, setXpByUser] = useState<Record<string, number>>({});

  const [compModeById, setCompModeById] = useState<Record<string, 'CLASSIC' | 'TOURNOI'>>({});
  const [tournamentXpDone, setTournamentXpDone] = useState<Record<string, boolean>>({});

  const selectedGrid = useMemo(
    () => grids.find(g => g.id === selectedGridId) || null,
    [grids, selectedGridId]
  );

  const selectedCompetitionId = useMemo(() => {
    if (mode === 'comp') return selectedCompId ?? null;
    if (!selectedGrid) return null;
    return selectedGrid.competition_id;
  }, [mode, selectedCompId, selectedGrid]);

  const totalXpToValidate = leaderboard.reduce((acc, r) => {
  const xp = Number(xpByUser[r.user_id] || 0);
    return acc + (xp > 0 ? xp : 0);
    }, 0);

  // Reset quand on change de mode / cible
  useEffect(() => {
    setLeaderboard([]);
    setXpByUser({});
    setMessage(null);
  }, [mode, selectedGridId, selectedCompId]);

  // Charger les compets XP + les grilles associées + statut XP déjà attribué
  useEffect(() => {
    (async () => {
      setLoadingTargets(true);
      setMessage(null);

      try {
        // 1) Competitions xp_enabled=true (on récupère aussi mode)
        const { data: comps, error: compsErr } = await supabase
          .from('competitions')
          .select('id,name,created_at,xp_enabled,mode')
          .eq('xp_enabled', true)
          .order('created_at', { ascending: false });

        if (compsErr) throw new Error(compsErr.message);

        const compsOk = (comps || []) as (CompetitionRow & { mode: 'CLASSIC' | 'TOURNOI' })[];
        setCompetitions(compsOk);

        // map competition_id -> mode
        const modeMap: Record<string, 'CLASSIC' | 'TOURNOI'> = {};
        compsOk.forEach(c => {
          if (c.id) modeMap[c.id] = c.mode;
        });
        setCompModeById(modeMap);

        const compIds = compsOk.map(c => c.id);
        if (compIds.length === 0) {
          setGrids([]);
          setGridXpDone({});
          setTournamentXpDone({});
          setCompXpDone({});
          return;
        }

        // 2) Grilles de ces compets (via grids.competition_id)
        const { data: gs, error: gsErr } = await supabase
          .from('grids')
          .select('id,title,created_at,competition_id,grid_done')
          .in('competition_id', compIds)
          .order('created_at', { ascending: false });

        if (gsErr) throw new Error(gsErr.message);

        const gridsOk = (gs || []) as GridRow[];
        setGrids(gridsOk);

        const gridIds = gridsOk.map(g => g.id).filter(Boolean);

        // 3) Statut "XP déjà attribuée" pour les grilles CLASSIC (kind = GRID_RANK)
        if (gridIds.length) {
          const { data: gx, error: gxErr } = await supabase
            .from('xp_events')
            .select('grid_id')
            .eq('kind', 'GRID_RANK')
            .in('grid_id', gridIds);

          if (gxErr) throw new Error(gxErr.message);

          const doneMap: Record<string, boolean> = {};
          (gx || []).forEach((r: any) => {
            if (r.grid_id) doneMap[r.grid_id] = true;
          });
          setGridXpDone(doneMap);
        } else {
          setGridXpDone({});
        }

        // 3bis) Statut "XP déjà attribuée" pour les grilles TOURNOI (kind = TOURNAMENT)
        if (gridIds.length) {
          const { data: tx, error: txErr } = await supabase
            .from('xp_events')
            .select('grid_id')
            .eq('kind', 'TOURNAMENT')
            .in('grid_id', gridIds);

          if (txErr) throw new Error(txErr.message);

          const tdone: Record<string, boolean> = {};
          (tx || []).forEach((r: any) => {
            if (r.grid_id) tdone[r.grid_id] = true;
          });
          setTournamentXpDone(tdone);
        } else {
          setTournamentXpDone({});
        }

        // 4) Statut "XP déjà attribuée" pour les compétitions (COMP_RANK = grid_id NULL)
        const { data: cx, error: cxErr } = await supabase
          .from('xp_events')
          .select('competition_id')
          .eq('kind', 'COMP_RANK')
          .in('competition_id', compIds)
          .is('grid_id', null);

        if (cxErr) throw new Error(cxErr.message);

        const cdone: Record<string, boolean> = {};
        (cx || []).forEach((r: any) => {
          if (r.competition_id) cdone[r.competition_id] = true;
        });
        setCompXpDone(cdone);

      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement'));
      } finally {
        setLoadingTargets(false);
      }
    })();
  }, [supabase]);


  const loadLeaderboard = async () => {
    setMessage(null);
    setLeaderboard([]);
    setXpByUser({});
    setLoadingBoard(true);

    try {
      if (mode === 'grid' || mode === 'tournament') {
        if (!selectedGridId) throw new Error('Choisis une grille.');
        const { data, error } = await supabase.rpc('get_leaderboard_by_grid', {
          p_grid_id: selectedGridId,
        });
        if (error) throw new Error(error.message);
        setLeaderboard((data || []) as LeaderRow[]);
      } else {
        if (!selectedCompId) throw new Error('Choisis une compétition.');
        const { data, error } = await supabase.rpc('get_leaderboard_general', {
          p_competition_id: selectedCompId,
        });
        if (error) throw new Error(error.message);
        setLeaderboard((data || []) as LeaderRow[]);
      }
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur chargement classement'));
    } finally {
      setLoadingBoard(false);
    }
  };

  const validateXp = async () => {
    setMessage(null);

    if (!selectedCompetitionId) {
      setMessage('❌ Impossible : compétition introuvable.');
      return;
    }

    if ((mode === 'grid' || mode === 'tournament') && !selectedGridId) {
      setMessage('❌ Choisis une grille.');
      return;
    }

    if (mode === 'comp' && !selectedCompId) {
      setMessage('❌ Choisis une compétition.');
      return;
    }

    if (!leaderboard.length) {
      setMessage('❌ Charge d’abord un classement.');
      return;
    }

    const rows = leaderboard
      .map(r => {
        const xp = Number(xpByUser[r.user_id] || 0);
        if (!xp || xp <= 0) return null;

        // ✅ TOURNOI : kind TOURNAMENT + grid_id non-null
        if (mode === 'tournament') {
          return {
            user_id: r.user_id,
            competition_id: selectedCompetitionId,
            grid_id: selectedGridId,
            kind: 'TOURNAMENT',
            xp,
            source_key: `tournament:${selectedGridId}:${r.user_id}`,
            note: 'Admin XP (tournoi)',
          };
        }

        // ✅ GRILLE CLASSIC : kind GRID_RANK + grid_id non-null
        if (mode === 'grid') {
          return {
            user_id: r.user_id,
            competition_id: selectedCompetitionId,
            grid_id: selectedGridId,
            kind: 'GRID_RANK',
            xp,
            source_key: `grid_rank:${selectedGridId}:${r.user_id}`,
            note: 'Admin XP (grille)',
          };
        }

        // ✅ GENERAL COMPET : kind COMP_RANK + grid_id null
        return {
          user_id: r.user_id,
          competition_id: selectedCompetitionId,
          grid_id: null,
          kind: 'COMP_RANK',
          xp,
          source_key: `comp_rank:${selectedCompetitionId}:${r.user_id}`,
          note: 'Admin XP (compétition)',
        };
      })
      .filter(Boolean) as any[];

    if (rows.length === 0) {
      setMessage('ℹ️ Aucun XP à valider (mets des valeurs > 0).');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('xp_events')
        .upsert(rows, { onConflict: 'source_key', ignoreDuplicates: true });

      if (error) throw new Error(error.message);

      setMessage(`✅ ${rows.length} attribution(s) enregistrée(s).`);

      // refresh statut "done"
      if (mode === 'grid') {
        setGridXpDone(prev => ({ ...prev, [selectedGridId!]: true }));
      } else if (mode === 'tournament') {
        setTournamentXpDone(prev => ({ ...prev, [selectedGridId!]: true }));
      } else {
        setCompXpDone(prev => ({ ...prev, [selectedCompetitionId]: true }));
      }
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur validation'));
    } finally {
      setSaving(false);
    }
  };

  const cancelXp = async () => {
    setMessage(null);

    if (!selectedCompetitionId) {
      setMessage('❌ Impossible : compétition introuvable.');
      return;
    }

    const label =
      mode === 'grid' ? 'cette grille (CLASSIC)' :
      mode === 'tournament' ? 'cette grille (TOURNOI)' :
      'cette compétition';

    if (!confirm(`Annuler tous les XP attribués pour ${label} ?`)) return;

    setSaving(true);
    try {
      // ✅ TOURNOI : delete kind TOURNAMENT sur grid_id
      if (mode === 'tournament') {
        if (!selectedGridId) throw new Error('Choisis une grille.');
        const { error } = await supabase
          .from('xp_events')
          .delete()
          .eq('kind', 'TOURNAMENT')
          .eq('grid_id', selectedGridId);

        if (error) throw new Error(error.message);

        setTournamentXpDone(prev => ({ ...prev, [selectedGridId]: false }));
        setMessage('✅ XP tournoi annulés.');
        return;
      }

      // ✅ GRILLE CLASSIC : delete kind GRID_RANK sur grid_id
      if (mode === 'grid') {
        if (!selectedGridId) throw new Error('Choisis une grille.');
        const { error } = await supabase
          .from('xp_events')
          .delete()
          .eq('kind', 'GRID_RANK')
          .eq('grid_id', selectedGridId);

        if (error) throw new Error(error.message);

        setGridXpDone(prev => ({ ...prev, [selectedGridId]: false }));
        setMessage('✅ XP grille annulés.');
        return;
      }

      // ✅ GENERAL COMPET : delete kind COMP_RANK sur competition_id et grid_id null
      if (!selectedCompId) throw new Error('Choisis une compétition.');
      const { error } = await supabase
        .from('xp_events')
        .delete()
        .eq('kind', 'COMP_RANK')
        .eq('competition_id', selectedCompetitionId)
        .is('grid_id', null);

      if (error) throw new Error(error.message);

      setCompXpDone(prev => ({ ...prev, [selectedCompetitionId]: false }));
      setMessage('✅ XP compétition annulés.');
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur annulation'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">XP</h2>

      {message && (
        <div className={`p-3 rounded ${message.startsWith('✅') ? 'bg-green-100 text-green-800' : message.startsWith('ℹ️') ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="block mb-1 font-medium">Type</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="border rounded p-2"
          >
            <option value="grid">Classement Grille (CLASSIC)</option>
            <option value="tournament">Tournoi (TOURNOI)</option>
            <option value="comp">Classement Général Compétition</option>
          </select>
        </div>

        {/* Petite liste filtrée selon le mode */}
        {(() => {
          const visibleGrids = grids.filter(g => {
            const cmode = compModeById[g.competition_id];
            if (mode === 'grid') return cmode === 'CLASSIC';
            if (mode === 'tournament') return cmode === 'TOURNOI';
            return false;
          });

          if (mode === 'grid' || mode === 'tournament') {
            return (
              <div className="flex-1">
                <label className="block mb-1 font-medium">
                  Grille ({mode === 'tournament' ? 'compétitions TOURNOI' : 'compétitions CLASSIC'})
                </label>
                <select
                  value={selectedGridId}
                  onChange={(e) => setSelectedGridId(e.target.value)}
                  className="w-full border rounded p-2"
                  disabled={loadingTargets}
                >
                  <option value="">— Choisir —</option>
                  {visibleGrids.map(g => {
                    const done = mode === 'tournament' ? tournamentXpDone[g.id] : gridXpDone[g.id];
                    return (
                      <option key={g.id} value={g.id}>
                        {done ? '✅ ' : '🕒 '}
                        {g.title}{g.grid_done ? '' : ' (non terminée)'}
                      </option>
                    );
                  })}
                </select>

                <div className="text-xs text-gray-500 mt-1">
                  🕒 = pas encore attribuée / ✅ = déjà attribuée
                </div>
              </div>
            );
          }

          // mode === 'comp'
          return (
            <div className="flex-1">
              <label className="block mb-1 font-medium">Compétition (XP activé)</label>
              <select
                value={selectedCompId}
                onChange={(e) => setSelectedCompId(e.target.value)}
                className="w-full border rounded p-2"
                disabled={loadingTargets}
              >
                <option value="">— Choisir —</option>
                {competitions.map(c => (
                  <option key={c.id} value={c.id}>
                    {compXpDone[c.id] ? '✅ ' : '🕒 '}
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="text-xs text-gray-500 mt-1">
                🕒 = pas encore attribuée / ✅ = déjà attribuée
              </div>
            </div>
          );
        })()}

        <div className="flex gap-2">
          <button
            onClick={loadLeaderboard}
            disabled={
              loadingBoard ||
              saving ||
              loadingTargets ||
              ((mode === 'grid' || mode === 'tournament') && !selectedGridId) ||
              (mode === 'comp' && !selectedCompId)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingBoard ? 'Chargement…' : 'OK'}
          </button>

          <button
            onClick={cancelXp}
            disabled={
              saving ||
              ((mode === 'grid' || mode === 'tournament') && !selectedGridId) ||
              (mode === 'comp' && !selectedCompId)
            }
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler XP
          </button>
        </div>
      </div>

      <div className="border rounded">
        <div className="p-3 border-b font-medium">Classement</div>

        {leaderboard.length === 0 ? (
          <div className="p-3 text-gray-600">
            {loadingBoard ? 'Chargement…' : 'Charge un classement pour saisir les XP.'}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Rank</th>
                  <th className="text-left p-2">Pseudo</th>
                  <th className="text-left p-2">Points</th>
                  <th className="text-left p-2">XP</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(r => (
                  <tr key={r.user_id} className="border-t">
                    <td className="p-2">{r.rank}</td>
                    <td className="p-2">{r.username}</td>
                    <td className="p-2">{r.total_points}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        value={xpByUser[r.user_id] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? '' : Number(e.target.value);
                          setXpByUser(prev => ({ ...prev, [r.user_id]: v === '' ? 0 : v }));
                        }}
                        className="w-24 border rounded p-1"
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

        <div className="p-3 flex justify-between items-center gap-2 border-t">
            <div className="text-sm text-gray-600">
                Total XP à valider : <span className="font-semibold">{totalXpToValidate}</span>
            </div>

            <button
                onClick={validateXp}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
                {saving ? 'Validation…' : 'Valider les XP'}
            </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Astuce : si tu t’es trompé, clique “Annuler XP”, recharge le classement, puis revalide.
      </div>
    </div>
  );
}
