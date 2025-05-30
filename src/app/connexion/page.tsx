'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    // Appel à l'endpoint Next.js /api/auth/signin
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErrorMsg(data.error_description || data.error || 'Identifiants invalides');
      return;
    }

    // Connexion OK → on force un full-page reload pour
    // être sûr que le middleware voie le cookie httpOnly
    const userEmail = data.user?.email;
    if (userEmail === ADMIN_EMAIL) {
      window.location.href = '/admin/grids';
    } else {
      window.location.href = '/';
    }
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email) {
      setErrorMsg('Veuillez d’abord saisir votre email ci-dessous.');
      return;
    }
    // Le reset reste côté client : supabase auth anon key suffit
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

        {errorMsg && (
          <div className="text-red-600 text-sm">{errorMsg}</div>
        )}
        {infoMsg && (
          <div className="text-green-600 text-sm">{infoMsg}</div>
        )}

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
