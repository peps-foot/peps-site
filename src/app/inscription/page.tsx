'use client';

import { useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider'
import { useRouter } from 'next/navigation';

export default function Inscription() {
  const supabase = useSupabase()
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    // 1) validations basiques
    if (email !== confirmEmail) {
      setMessage("Les adresses email ne correspondent pas.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (username.trim().length < 3) {
      setMessage("Le pseudo doit contenir au moins 3 caractères.");
      return;
    }

    // 2) création de l'utilisateur dans Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error(signUpError);
      setMessage("Erreur d'inscription : " + signUpError.message);
      return;
    }

    // 3) une fois inscrit, on crée le profil public
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ user_id: signUpData.user!.id, username: username.trim() }]);

    if (profileError) {
      console.error(profileError);
      setMessage("Inscrit, mais impossible de sauvegarder le pseudo.");
    } else {
      setMessage("Compte et pseudo créés avec succès !");
      // réinitialisation des champs
      setEmail('');
      setConfirmEmail('');
      setPassword('');
      setConfirmPassword('');
      setUsername('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-black-600">
          Inscription
        </h1>

        {message && (
          <div className="mb-4 text-center text-green-500">{message}</div>
        )}

        <input
          type="email"
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />

        <input
          type="email"
          placeholder="Confirmer email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />

        <input
          type="password"
          placeholder="Confirmer mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />

        <input
          type="text"
          placeholder="Pseudo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 mb-6 border rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Créer mon compte
        </button>

          {/* Bouton retour connexion */}
          <button
            type="button"
            onClick={() => router.push("/connexion")}
            className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded"
          >
            Retour à la connexion
          </button>
      </form>
    </div>
  );
}
