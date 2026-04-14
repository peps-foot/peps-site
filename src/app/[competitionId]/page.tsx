// fichier de routage pour aller vers des compétitions game_type = GRID ou TIERCE

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import supabase from '../../lib/supabaseBrowser';
import { useSupabase } from '../../components/SupabaseProvider'
import GridScreen from './_screens/GridScreen';
import TierceScreen from './_screens/TierceScreen';

type CompetitionLite = {
  id: string;
  name: string;
  mode: string | null;
  kind: string | null;
  game_type: 'GRID' | 'TIERCE' | 'SUPPORTER' | null;
};

export default function CompetitionPage() {
  const params = useParams();
  const competitionId = params?.competitionId as string;

  const [competition, setCompetition] = useState<CompetitionLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!competitionId) return;

    (async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, mode, kind, game_type')
        .eq('id', competitionId)
        .maybeSingle();

      if (error || !data) {
        setCompetition(null);
      } else {
        setCompetition(data);
      }

      setLoading(false);
    })();
  }, [competitionId]);

  if (loading) {
    return <div className="p-6">Chargement…</div>;
  }

  if (!competition) {
    return <div className="p-6">Compétition introuvable.</div>;
  }

  if (competition.game_type === 'TIERCE') {
    return (
      <TierceScreen
        competitionId={competitionId}
        isPrivate={competition.kind === 'private'}
      />
    );
  }

  return <GridScreen />;
}