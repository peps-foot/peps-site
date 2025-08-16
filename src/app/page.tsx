'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";

type Competition = {
  id: string;
  name: string;
  description: string;
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
      const { data, error } = await supabase.from('competitions').select('id, name, description');
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
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <p className="text-sm sm:text-base leading-relaxed">
        <span className="mr-2">🏆</span>
        <span className="font-semibold">Pour la coupe d'été :</span> Le jeu comporte 9 grilles de 9 matchs. Le premier au classement général final remportera <span className="font-semibold">50 €</span> 💸
      </p>
    </div>

    {/* Bandeau de recrutement testeurs */}
    <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="text-sm sm:text-base leading-relaxed">
        <span className="mr-2">📱</span>
        <span className="font-semibold">Tester l’application PEPS :</span>{' '}
        Participez à la phase de test et aidez-nous à améliorer le jeu&nbsp;!
        <br />
        <a
          href="https://play.google.com/apps/testing/com.peps_foot.www.twa"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 px-3 py-1 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded"
        >
          📥 Télécharger l’app Android
        </a>
          avec votre adresse mail playstore
      </p>
    </div>

    {/* Liste des compétitions */}
      {competitions.map((comp) => (
        <div
          key={comp.id}
          onClick={() => router.push(`/${comp.id}`)}
          className="bg-blue-100 rounded-md p-3 shadow cursor-pointer hover:bg-blue-200 transition flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <Image
              src="/images/compet/ligue1.png"
              alt="Ligue 1"
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
