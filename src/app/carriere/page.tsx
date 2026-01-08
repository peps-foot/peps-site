'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider';

type CareerRow = {
  user_id: string;
  username: string;

  total_xp: number;
  xp_grids: number;
  xp_compets: number;
  xp_tournament: number;

  rank_total: number;
  rank_grids: number;
  rank_compets: number;
  rank_tournament: number;
};

const GROUP_SIZE = 5;

type CategoryMeta = {
  key: string;
  label: string;
  headerClass: string;       // style bandeau catégorie
  highlightRowClass: string; // surlignage “moi”
  badgeClass: string;        // petit badge sur “moi”
};

const CATEGORIES: CategoryMeta[] = [
  // Podium
  { key: 'legendes',  label: 'Légendes',  headerClass: 'bg-yellow-400 text-yellow-900', highlightRowClass: 'bg-yellow-50',   badgeClass: 'bg-yellow-400 text-yellow-900' },
  { key: 'stars',     label: 'Stars',     headerClass: 'bg-slate-400 text-slate-900',  highlightRowClass: 'bg-slate-50',    badgeClass: 'bg-slate-300 text-slate-900' },
  { key: 'elite',     label: 'Élite',     headerClass: 'bg-orange-800 text-white',     highlightRowClass: 'bg-orange-50',  badgeClass: 'bg-orange-800 text-white' },

  // Prestige
  { key: 'maitres',   label: 'Maîtres',   headerClass: 'bg-neutral-900 text-white',    highlightRowClass: 'bg-neutral-100', badgeClass: 'bg-neutral-900 text-white' },

  // Progression
  { key: 'experts',     label: 'Experts',     headerClass: 'bg-purple-600 text-white', highlightRowClass: 'bg-purple-50',   badgeClass: 'bg-purple-600 text-white' },
  { key: 'challengers', label: 'Challengers', headerClass: 'bg-blue-600 text-white',   highlightRowClass: 'bg-blue-50',     badgeClass: 'bg-blue-600 text-white' },
  { key: 'confirmes',   label: 'Confirmés',   headerClass: 'bg-green-600 text-white',  highlightRowClass: 'bg-green-50',    badgeClass: 'bg-green-600 text-white' },
  { key: 'espoirs',     label: 'Espoirs',     headerClass: 'bg-orange-500 text-white', highlightRowClass: 'bg-orange-50',   badgeClass: 'bg-orange-500 text-white' },
];

const AMATEURS: CategoryMeta = {
  key: 'amateurs',
  label: 'Amateurs',
  headerClass: 'bg-white text-gray-700 border',
  highlightRowClass: 'bg-gray-50',
  badgeClass: 'bg-gray-200 text-gray-800',
};

function getCategoryForRank(rank: number): CategoryMeta {
  const bucket = Math.floor((rank - 1) / GROUP_SIZE); // 0..7
  if (bucket >= 0 && bucket < CATEGORIES.length) return CATEGORIES[bucket];
  return AMATEURS;
}

function ordinalFr(n: number) {
  return n === 1 ? '1er' : `${n}e`;
}

type TabKey = 'total' | 'grids' | 'compets' | 'tournament';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'total', label: 'Général' },
  { key: 'grids', label: 'As de la grille' },
  { key: 'compets', label: 'Roi des compets' },
  { key: 'tournament', label: 'Tueur de tournois' },
];

const TAB_DESC: Record<TabKey, string> = {
  total: 'Classement de tes perfs sur PEPS',
  grids: 'Classement de tes perfs sur les grilles',
  compets: 'Classement de tes perfs au général des compets',
  tournament: 'Classement de tes perfs aux tournois',
};

export default function CarrierePage() {
  const supabase = useSupabase();

  const [tab, setTab] = useState<TabKey>('total');

  const [rows, setRows] = useState<CareerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMyUserId(data.user?.id ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase.rpc('get_leaderboard_career_full');

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as CareerRow[]);
      }

      setLoading(false);
    })();
  }, [supabase]);

  // Helpers : quel XP et quel rank selon l’onglet
  const getXp = (r: CareerRow) => {
    if (tab === 'total') return r.total_xp;
    if (tab === 'grids') return r.xp_grids;
    if (tab === 'compets') return r.xp_compets;
    return r.xp_tournament;
  };

  const getRank = (r: CareerRow) => {
    if (tab === 'total') return r.rank_total;
    if (tab === 'grids') return r.rank_grids;
    if (tab === 'compets') return r.rank_compets;
    return r.rank_tournament;
  };

  const sortedRows = useMemo(() => {
    // Pour les 3 onglets “simples”, on veut l’ordre CROISSANT par rank
    // (et en cas d’égalité, on trie par pseudo pour que ce soit stable)
    if (tab === 'total') return rows;

    return [...rows].sort((a, b) => {
        const ra = getRank(a);
        const rb = getRank(b);
        if (ra !== rb) return ra - rb;
        return a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });
    });
    }, [rows, tab, getRank]);


  // Pour l’onglet “Général” : on veut un regroupement par catégorie sur rank_total
  const groupedTotal = useMemo(() => {
    if (tab !== 'total') return [];

    const map = new Map<string, { meta: CategoryMeta; rows: CareerRow[] }>();

    for (const r of rows) {
      const meta = getCategoryForRank(r.rank_total);
      const key = meta.key;

      if (!map.has(key)) map.set(key, { meta, rows: [] });
      map.get(key)!.rows.push(r);
    }

    const ordered: { meta: CategoryMeta; rows: CareerRow[] }[] = [];
    for (const meta of CATEGORIES) {
      const block = map.get(meta.key);
      if (block && block.rows.length) ordered.push(block);
    }
    const amateursBlock = map.get(AMATEURS.key);
    if (amateursBlock && amateursBlock.rows.length) ordered.push(amateursBlock);

    return ordered;
  }, [rows, tab]);

  const myRow = useMemo(() => {
    if (!myUserId) return null;
    return rows.find(r => r.user_id === myUserId) ?? null;
  }, [rows, myUserId]);

  const myRankForTab = useMemo(() => {
    if (!myRow) return null;
    return getRank(myRow);
  }, [myRow, tab]);

  const myCategoryTotal = useMemo(() => {
    if (!myRow) return null;
    return getCategoryForRank(myRow.rank_total);
  }, [myRow]);

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Onglets */}
      <div className="flex gap-2 justify-center flex-wrap mb-6">
        {TABS.map(t => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 rounded-full border text-sm transition
                ${active ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm text-gray-600 mb-4">
        {TAB_DESC[tab]}
      </p>

      {loading && (
        <p className="text-center text-sm text-gray-500 my-6">Chargement…</p>
      )}

      {!loading && err && (
        <div className="p-3 bg-red-100 text-red-800 rounded">
          ❌ {err}
        </div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="p-4 bg-gray-50 border rounded text-center text-gray-700">
          Pas encore classé… mais ça va venir 👀
        </div>
      )}

      {!loading && !err && rows.length > 0 && (
        <>
          {/* Phrase “Tu es …” */}
          {myRankForTab !== null ? (
            <div className="mx-auto mb-6 max-w-xl">
              {tab === 'total' && myCategoryTotal ? (
                <div className={`p-3 rounded-lg ${myCategoryTotal.highlightRowClass} border`}>
                  <div className="text-sm text-gray-800 font-semibold text-center">
                    Tu es {ordinalFr(myRow!.rank_total)} — {myCategoryTotal.label.toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-gray-50 border text-sm text-gray-800 font-semibold text-center">
                  Tu es {ordinalFr(myRankForTab)}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto mb-6 max-w-xl">
              <div className="p-3 rounded-lg bg-gray-50 border text-sm text-gray-700 text-center">
                Pas encore classé… mais ça va venir 👀
              </div>
            </div>
          )}

          {/* ===== ONGLET GÉNÉRAL : catégories ===== */}
          {tab === 'total' ? (
            <div className="space-y-6">
              {groupedTotal.map(({ meta, rows: catRows }) => (
                <div key={meta.key} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className={`px-4 py-2 font-semibold text-center tracking-wide ${meta.headerClass}`}>
                    {meta.label.toUpperCase()}
                  </div>

                  <div className="divide-y">
                    {catRows.map((r) => {
                      const isMe = myUserId && r.user_id === myUserId;
                      return (
                        <div
                          key={r.user_id}
                          className={`flex items-center justify-between px-4 py-2 ${
                            isMe ? meta.highlightRowClass + ' font-semibold' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="w-8 text-right tabular-nums">{r.rank_total}</span>
                            <span className="truncate">{r.username}</span>

                          </div>

                          <div className="text-sm font-semibold text-gray-700 tabular-nums">
                            {r.total_xp} XP
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ===== 3 AUTRES ONGLET : tableau simple ===== */
            <div className="max-w-2xl mx-auto">
              <table className="w-full bg-white shadow rounded-lg overflow-hidden text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">Rang</th>
                    <th className="text-left px-4 py-3">Pseudo</th>
                    <th className="text-left px-4 py-3">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(r => {
                    const isMe = myUserId && r.user_id === myUserId;
                    const rank = getRank(r);
                    const xp = getXp(r);

                    return (
                      <tr
                        key={r.user_id}
                        className={`border-t transition ${isMe ? 'bg-orange-100 font-bold' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2 tabular-nums">{rank}</td>
                        <td className="px-4 py-2">{r.username}</td>
                        <td className="px-4 py-2 tabular-nums">{xp}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
