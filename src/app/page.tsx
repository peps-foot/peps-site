'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CompetitionStatusBadge from "../components/CompetitionStatusBadge";
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";
import { CompetitionMode, Competition } from '../lib/types';
import { groupCompetitionsForHome } from "../lib/competitionStatus";
import RandomPromo from '../components/RandomPromo';

export default function Home() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [groups, setGroups] = useState<{mine: Competition[]; toJoin: Competition[]; history: Competition[]}>({
    mine: [], toJoin: [], history: []
  });
  const [statuses, setStatuses] = useState<Map<string, {label: string; color: "blue"|"green"|"gray"; isActiveRank: boolean}>>(new Map());
  const [ready, setReady] = useState(false);
  const { mine, toJoin, history } = groups;

  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const type = params.get('type');

      if (type === 'recovery') {
        console.log('🟡 URL de réinitialisation détectée — pas de redirection.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('🔴 Pas de session, redirection vers /connexion');
        router.replace('/connexion');
        return;
      }

      setSessionChecked(true);
    };

    check();
  }, [router]);

  useEffect(() => {
    const fetchCompetitions = async () => {
      const { data, error } = await supabase
      .from('competitions')
      .select('id, name, description, icon, mode');

      const competitions: Competition[] = (data ?? []).map((c) => ({
        ...c,
        mode: (c.mode ?? "CLASSIC") as CompetitionMode,
      }));

      if (!error && data) {
        setCompetitions(data);
      } else {
        console.error('Erreur récupération competitions :', error);
      }
    };

    if (sessionChecked) fetchCompetitions();
  }, [sessionChecked]);

  useEffect(() => {
    const run = async () => {
      if (!sessionChecked) return;
      if (competitions.length === 0) { setGroups({ mine: [], toJoin: [], history: [] }); setReady(true); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const slim = competitions.map(c => ({ id: c.id, mode: c.mode }));
      const res = await groupCompetitionsForHome(slim, user.id);

      setGroups({
        mine: competitions.filter(c => res.mine.some(x => x.id === c.id)),
        toJoin: competitions.filter(c => res.toJoin.some(x => x.id === c.id)),
        history: competitions.filter(c => res.history.some(x => x.id === c.id)),
      });
      setReady(true);
    };
    run();
  }, [sessionChecked, competitions]);

  if (!sessionChecked) return null;

  return (
  <main className="px-4 py-8 max-w-3xl mx-auto">
    {/* Pub PEPS aléatoire */}
    <RandomPromo />

    {/* Liste des compétitions */}
{/* MES COMPÉT' */}
<details open className="mb-4 rounded-md border">
  <summary className="cursor-pointer select-none px-4 py-2 font-semibold">MES COMPÉT'</summary>
  <div className="p-2">
    {mine.length === 0 && <p className="px-2 py-1 text-sm text-gray-600">Aucune pour le moment.</p>}
    {mine.map((comp) => (
      <div
        key={comp.id}
        onClick={() => router.push(`/${comp.id}`)}
        className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-2"
      >
        <div className="flex items-center space-x-3">
          <Image
            src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
            alt={comp.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
          />
          <div>
            <p className="text-green-600 font-bold">{comp.name}</p>
            <p className="text-sm text-gray-800">{comp.description}</p>
          </div>
        </div>
        <CompetitionStatusBadge competitionId={comp.id} mode={comp.mode} />
      </div>
    ))}
  </div>
</details>

{/* À REJOINDRE */}
<details open className="mb-4 rounded-md border">
  <summary className="cursor-pointer select-none px-4 py-2 font-semibold">À REJOINDRE</summary>
  <div className="p-2">
    {toJoin.length === 0 && <p className="px-2 py-1 text-sm text-gray-600">Rien à rejoindre pour l’instant.</p>}
    {toJoin.map((comp) => (
      <div
        key={comp.id}
        onClick={() => router.push(`/${comp.id}`)}
        className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-2"
      >
        <div className="flex items-center space-x-3">
          <Image
            src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
            alt={comp.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
          />
          <div>
            <p className="text-green-600 font-bold">{comp.name}</p>
            <p className="text-sm text-gray-800">{comp.description}</p>
          </div>
        </div>
        <CompetitionStatusBadge competitionId={comp.id} mode={comp.mode} />
      </div>
    ))}
  </div>
</details>

{/* HISTORIQUE */}
<details className="mb-4 rounded-md border">
  <summary className="cursor-pointer select-none px-4 py-2 font-semibold">HISTORIQUE</summary>
  <div className="p-2">
    {history.length === 0 && <p className="px-2 py-1 text-sm text-gray-600">Aucune compétition terminée.</p>}
    {history.map((comp) => (
      <div
        key={comp.id}
        onClick={() => router.push(`/${comp.id}`)}
        className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-2"
      >
        <div className="flex items-center space-x-3">
          <Image
            src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
            alt={comp.name}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10"
          />
          <div>
            <p className="text-green-600 font-bold">{comp.name}</p>
            <p className="text-sm text-gray-800">{comp.description}</p>
          </div>
        </div>
        <CompetitionStatusBadge competitionId={comp.id} mode={comp.mode} />
      </div>
    ))}
  </div>
</details>


    </main>
  );
}
