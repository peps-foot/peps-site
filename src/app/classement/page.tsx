'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Leaderboard from '@/components/Leaderboard';

export default function ClassementPage() {
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // On récupère la dernière compétition créée
      const { data, error } = await supabase
        .from('competitions')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Erreur fetch competitions:', error);
      } else if (data) {
        setCompetitionId(data.id);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-center">Chargement du classement…</div>;
  }

  if (!competitionId) {
    return (
      <div className="p-6 text-center text-red-500">
        Aucune compétition trouvée.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Classement</h1>
      <Leaderboard competitionId={competitionId} />
    </div>
  );
}
