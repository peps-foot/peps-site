'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";

type Competition = {
  id: string;
  name: string;
  description: string | null; // selon ta BDD ça peut être null
  icon?: string | null;       // <-- nouveau champ (optionnel)
};

export default function Home() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [sessionChecked, setSessionChecked] = useState(false);

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
      const { data, error } = await supabase.from('competitions').select('id, name, description, icon');
      if (!error && data) {
        setCompetitions(data);
      } else {
        console.error('Erreur récupération competitions :', error);
      }
    };

    if (sessionChecked) fetchCompetitions();
  }, [sessionChecked]);

  if (!sessionChecked) return null;

  return (
  <main className="px-4 py-8 max-w-3xl mx-auto">
    {/* Bandeau d'info */}
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-justify">
      <div className="space-y-6">
        <div className="space-y-2 text-left">
          <p>🏆 La<strong> Coupe d'Été</strong> se termine le 26 octobre.</p>
          <p>🏆 La<strong> Coupe d'Automne</strong> commence le 29 octobre.</p>
          <p></p>
          <p>🦈 Le<strong> Shark Game</strong> est un tournoi à éliminations qui commence dès le 3 octobre, ça va saigner !!</p>
        </div>
      </div>

    </div>

    {/* Présentation */}
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-justify">
      <p className="text-sm sm:text-base leading-relaxed">
        <span className="font-semibold">
          Sélectionne ta compet, mets ta croix sur chaque match et joue ton bonus pour faire la diff ! ⚽🔥
        </span>
      </p>
    </div>

    {/* Liste des compétitions */}
    {competitions.map((comp) => (
      <div
        key={comp.id}
        onClick={() => router.push(`/${comp.id}`)}
        className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between mb-4"
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
        <div className="border border-black px-4 py-1 bg-white">
          JOUER
        </div>
      </div>
    ))}

    </main>
  );
}
