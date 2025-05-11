'use client';

import { useState } from 'react';
import { fetchFixtures } from '@/lib/fetchFixtures';
import { supabase } from '@/lib/supabaseClient';

export default function AdminFixtures() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setMessage('Import des fixtures et des cotes…');
    try {
      const fixtures = await fetchFixtures('Regular Season - 31');

      // 1) Upsert des matches
      const toUpsertMatches = fixtures.map((f) => ({
        fixture_id:  f.fixture.id,
        date:         f.fixture.date,
        home_team:    f.teams.home.name,
        away_team:    f.teams.away.name,
        score_home:   f.goals.home,
        score_away:   f.goals.away,
        competition:  f.league.name,
      }));
      await supabase
        .from('matches')
        .upsert(toUpsertMatches, { onConflict: 'fixture_id' });

      // 2) Upsert des cotes dans odds
      for (const f of fixtures) {
        // génération de cotes simulées
        const odd1 = +(Math.random() * 3.5 + 1.5).toFixed(2);
        const oddX = +(Math.random() * 3.5 + 1.5).toFixed(2);
        const odd2 = +(Math.random() * 3.5 + 1.5).toFixed(2);

        // récupération de l'UUID interne du match
        const { data: matchRow, error: matchErr } = await supabase
          .from('matches')
          .select('id')
          .eq('fixture_id', f.fixture.id)
          .single();

        if (matchErr || !matchRow) {
          console.error('Match introuvable pour fixture', f.fixture.id, matchErr);
          continue;
        }

        // on upserte dans odds (match_id + provider unique)
        const { error: oddsErr } = await supabase
          .from('odds')
          .upsert(
            {
              match_id: matchRow.id,
              provider: 'API-football (simulé)',
              odd_1:    odd1,
              odd_X:    oddX,
              odd_2:    odd2,
            },
            { onConflict: ['match_id', 'provider'] }
          );

        if (oddsErr) console.error('Erreur upsert odds', oddsErr);
      }

      setMessage('Import terminé : fixtures et cotes enregistrées.');
    } catch (err: any) {
      console.error(err);
      setMessage('Erreur pendant l’import : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Admin – Importer les fixtures & cotes</h1>
      <button
        onClick={handleImport}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? 'Import en cours…' : 'Importer Journée 31 + cotes'}
      </button>
      {message && <p className="mt-4 text-red-700">{message}</p>}
    </div>
  );
}
