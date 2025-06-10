'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSupabase } from '@/components/SupabaseProvider'

export default function ConnexionPage() {
  const supabase = useSupabase()
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    console.log("✅ Connexion réussie, session :", data.session);
    const userEmail = data.user?.email;

    // ✅ Laisser le temps à Supabase de stabiliser la session (important !)
    setTimeout(() => {
      if (userEmail === 'admin@peps.foot') {
        router.push('/admin/grids');
      } else {
        router.push('/home');
      }
    }, 200); // ← suffisant pour éviter les effets de course
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg('Veuillez d’abord saisir votre email ci-dessous.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/connexion',
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setInfoMsg('Un email de récupération vient de vous être envoyé.');
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Connexion</h1>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            className="w-full border rounded px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1">Mot de passe</label>
          <input
            type="password"
            className="w-full border rounded px-2 py-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
        {infoMsg && <div className="text-green-600 text-sm">{infoMsg}</div>}

        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
        >
          Se connecter
        </button>
      </form>

      <div className="flex justify-between text-sm">
        <button
          onClick={handleForgotPassword}
          className="text-blue-600 hover:underline"
        >
          Mot de passe oublié ?
        </button>
        <button
          onClick={() => router.push('/inscription')}
          className="text-blue-600 hover:underline"
        >
          Inscrivez-vous
        </button>
      </div>
    </div>
  );
}
