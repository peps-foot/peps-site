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
    <main className="p-4 space-y-4 bg-gray-100 min-h-screen">
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
