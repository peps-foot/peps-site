// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase }             from '@/lib/supabaseClient';

type MatchRow = {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  odds?: {                // on autorise undefined
    odd_1: number;
    odd_X: number;
    odd_2: number;
  };
};

type Grid = {
  id: string;
  title: string;
  description: string | null;
};

type GridItem = {
  match: MatchRow;
};

export default function HomePage() {
  const [grid,    setGrid]    = useState<Grid | null>(null);
  const [items,   setItems]   = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function loadGrid() {
      try {
        // 1) Récupère la grille la plus récente
        const { data: grids, error: gErr } = await supabase
          .from('grids')
          .select('id,title,description')
          .order('created_at', { ascending: false })
          .limit(1);
        if (gErr) throw gErr;
        if (!grids?.length) {
          setLoading(false);
          return;
        }
        const latest = grids[0];
        setGrid(latest);

        // 2) Récupère les matchs + cotes imbriquées
        const { data: rows, error: iErr } = await supabase
          .from('grid_items')
          .select(`
            match:matches (
              id,
              date,
              home_team,
              away_team,
              odds:odds (
                odd_1,
                odd_X,
                odd_2
              )
            )
          `)
          .eq('grid_id', latest.id)
          .order('date', { foreignTable: 'match', ascending: true });
        if (iErr) throw iErr;

        setItems(rows as GridItem[]);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadGrid();
  }, []);

  if (loading) return <div className="p-8 text-center">Chargement…</div>;
  if (error)   return <div className="p-8 text-red-600">Erreur : {error}</div>;
  if (!grid)   return <div className="p-8 text-center">Aucune grille disponible.</div>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <section className="max-w-3xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-heading text-primary">{grid.title}</h1>
          {grid.description && (
            <p className="text-gray-700">{grid.description}</p>
          )}
        </header>

        <div className="space-y-4">
          {items.map(({ match }) => (
            <div
              key={match.id}
              className="flex items-center border border-gray-300 rounded-lg bg-white p-4"
            >
              {/* Domicile */}
              <div className="flex-1 text-left font-semibold">
                {match.home_team}
              </div>

              {/* Prono & cotes */}
              <div className="flex flex-col items-center px-4">
                <div className="flex space-x-3">
                  {['1','N','2'].map(opt => (
                    <label key={opt} className="flex flex-col items-center">
                      <input
                        type="radio"
                        name={`prono-${match.id}`}
                        value={opt}
                        className="form-radio text-primary"
                      />
                      <span className="mt-1 text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
                <div className="flex space-x-6 text-xs text-gray-600 mt-1">
                  <span>
                    {match.odds?.odd_1 != null
                      ? match.odds.odd_1.toFixed(2)
                      : '–'}
                  </span>
                  <span>
                    {match.odds?.odd_X != null
                      ? match.odds.odd_X.toFixed(2)
                      : '–'}
                  </span>
                  <span>
                    {match.odds?.odd_2 != null
                      ? match.odds.odd_2.toFixed(2)
                      : '–'}
                  </span>
                </div>
              </div>

              {/* Extérieur */}
              <div className="flex-1 text-right font-semibold">
                {match.away_team}
              </div>

              {/* Cercle bonus */}
              <div className="w-8 h-8 border-2 border-gray-400 rounded-full ml-4 flex-shrink-0"></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
