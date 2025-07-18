'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const supabase = useSupabase();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState('');

    useEffect(() => {
    const restoreSession = async () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const codeInQuery = new URLSearchParams(window.location.search).get('code');

        if (codeInQuery) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(codeInQuery);

        if (error) {
            console.error('Erreur de récupération via code:', error);
            setError("Lien invalide ou expiré. Veuillez redemander un email.");
            setLoading(false);
            return;
        }
        } else {
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');

        if (access_token && refresh_token && type === 'recovery') {
            const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
            });

            if (error) {
            console.error('Erreur de session :', error);
            setError("Lien invalide ou expiré. Veuillez redemander un email.");
            setLoading(false);
            return;
            }
        } else {
            setError("Lien invalide ou expiré. Veuillez redemander un email.");
            setLoading(false);
            return;
        }
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (user) {
        setUserEmail(user.email || '');
        } else {
        setError("Lien invalide ou expiré. Veuillez redemander un email.");
        }

        setLoading(false);
    };

    restoreSession();
    }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError('Erreur lors du changement de mot de passe.');
    } else {
      alert('Mot de passe mis à jour avec succès !');
      router.push(autoLogin ? '/profil' : '/connexion');
    }
  };

  if (loading) return <div className="p-6 text-center">Chargement...</div>;

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">🔑 Nouveau mot de passe</h2>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {!error && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            Adresse associée : <strong>{userEmail}</strong>
          </p>

          <div>
            <label className="block text-sm mb-1">Nouveau mot de passe :</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Confirmer le mot de passe :</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={() => setAutoLogin(!autoLogin)}
              className="mr-2"
            />
            <label className="text-sm">Se connecter automatiquement après mise à jour</label>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
          >
            Valider
          </button>
        </form>
      )}
    </div>
  );
}
