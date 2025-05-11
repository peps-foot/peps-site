'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });

    if (error) {
      setErreur(error.message);
    } else {
      // Redirection vers l'accueil ou tableau de bord
      router.push('/');
    }

    setChargement(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Connexion</h1>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label>Email</label>
          <input
            type="email"
            className="w-full border p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Mot de passe</label>
          <input
            type="password"
            className="w-full border p-2"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        <div className="text-center">
          <button
            type="submit"
            disabled={chargement}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
        {erreur && <p className="text-red-600 text-center">{erreur}</p>}
      </form>
  
      <div className="mt-4 flex justify-between text-sm">
        <a href="/inscription" className="text-blue-600 hover:underline">Pas encore inscrit ?</a>
        <a href="/mot-de-passe-oublie" className="text-blue-600 hover:underline">Mot de passe oublié ?</a>
      </div>
    </div>
  );  
}
