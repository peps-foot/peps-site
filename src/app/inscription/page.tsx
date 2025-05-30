'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();

  // États pour les champs
  const [email, setEmail]                 = useState('');
  const [confirmEmail, setConfirmEmail]   = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername]           = useState('');
  const [message, setMessage]             = useState<string|null>(null);
  const [loading, setLoading]             = useState(false);

  const MIN_USERNAME_LENGTH = 3;
  const MAX_USERNAME_LENGTH = 15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 1) validations avant appel
    if (!email || !confirmEmail || !password || !confirmPassword || !username) {
      setMessage('Tous les champs sont obligatoires.');
      return;
    }
    if (email !== confirmEmail) {
      setMessage("Les adresses email ne correspondent pas.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (username.trim().length < MIN_USERNAME_LENGTH) {
      setMessage(`Le pseudo doit comporter au moins ${MIN_USERNAME_LENGTH} caractères.`);
      return;
    }
    if (username.trim().length > MAX_USERNAME_LENGTH) {
      setMessage(`Le pseudo ne peut pas dépasser ${MAX_USERNAME_LENGTH} caractères.`);
      return;
    }

    setLoading(true);

    // 2) vérification d’unicité du pseudo en base
    const { data: existing, error: existErr } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', username.trim())
      .maybeSingle();
    if (existErr) {
      console.error('Erreur vérif pseudo :', existErr);
      setMessage("Impossible de vérifier l'unicité du pseudo.");
      setLoading(false);
      return;
    }
    if (existing) {
      setMessage('Ce pseudo est déjà pris, veuillez en choisir un autre.');
      setLoading(false);
      return;
    }

    // 3) création de l’utilisateur dans Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) {
      console.error('Erreur d’inscription :', signUpError);
      setMessage("Erreur d'inscription : " + signUpError.message);
      setLoading(false);
      return;
    }

    // 4) insertion du pseudo dans profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ user_id: signUpData.user!.id, username: username.trim() }]);
    if (profileError) {
      console.error('Erreur sauvegarde pseudo :', profileError);
      setMessage("Inscrit, mais impossible de sauvegarder le pseudo.");
      setLoading(false);
      return;
    }

    // 5) succès
    setMessage("Compte et pseudo créés avec succès ! Vous pouvez maintenant vous connecter.");
    setEmail('');
    setConfirmEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');

    // Optionnel : redirection vers la page de connexion
    // router.push('/connexion');
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Inscription</h1>
      {message && (
        <div className="mb-4 text-red-600">{message}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Adresse email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1">Confirmer email</label>
          <input
            type="email"
            value={confirmEmail}
            onChange={e => setConfirmEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1">Confirmer mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block mb-1">Pseudo</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Entre {MIN_USERNAME_LENGTH} et {MAX_USERNAME_LENGTH} caractères.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Patientez…' : 'Créer mon compte'}
        </button>
      </form>
      {/* → nouveau bouton "retour à la connexion" */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => router.push('/connexion')}
          className="text-blue-600 hover:underline"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}