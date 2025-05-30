'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type LeaderboardRow = {
  user_id:     string;
  username:    string;
  total_points: number;
};

export default function Leaderboard({ competitionId }: { competitionId: string }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) return;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .rpc('compute_leaderboard', { p_competition_id: competitionId });
        if (error) {
        console.error('compute_leaderboard error', JSON.stringify(error, null, 2));
        } else {
        setRows(data as LeaderboardRow[]);
      }
      setLoading(false);
    })();
  }, [competitionId]);

  if (loading) {
    return <div className="p-6 text-center">Chargement du classement…</div>;
  }

  if (rows.length === 0) {
    return <div className="p-6 text-center">Aucun participant pour cette compétition.</div>;
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2">#</th>
          <th className="px-4 py-2">Joueur</th>
          <th className="px-4 py-2">Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.user_id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
            <td className="px-4 py-2">{idx + 1}</td>
            <td className="px-4 py-2">{row.username}</td>
            <td className="px-4 py-2">{row.total_points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
