'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../utils/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)

  console.log("🔍 URL hash:", window.location.hash);
  console.log("🔍 URL search:", window.location.search);

  // 🔁 Restaure la session depuis le lien reçu (code ou access_token)
    useEffect(() => {
    const restoreSession = async () => {
        try {
            const url = new URL(window.location.href);
            const code = url.searchParams.get('code');
            const type = url.searchParams.get('type') ?? ''; // par sécurité, défaut = chaîne vide

            console.log("🔐 Code extrait :", code);
            console.log("🔍 URL search:", url.search);
            console.log("🔍 URL hash:", url.hash);

            // Si des tokens sont présents dans le hash
            const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
            const hashParams = new URLSearchParams(hash);
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            console.log("🧪 Token access:", access_token);
            console.log("🧪 Token refresh:", refresh_token);

            if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            console.log("✅ Session restaurée via code !");
            } else if (access_token && refresh_token && type === 'recovery') {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            console.log("✅ Session restaurée via token !");
            } else {
            throw new Error('Lien invalide ou incomplet.');
            }

        await new Promise(resolve => setTimeout(resolve, 500))

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (!user?.email) throw userError || new Error("Utilisateur non trouvé.")
        setEmail(user.email)
        setLoading(false)
        } catch (e) {
        console.error('⛔ Erreur de session :', e)
        setError("Lien invalide ou expiré. Veuillez redemander un email.")
        setLoading(false)
        }
    }

    restoreSession()
    }, [])

  const handleSubmit = async () => {
    setError('')

    if (!password || !confirmPassword) {
      setError('Tous les champs sont requis.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => {
        router.push('/connexion')
      }, 2000)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">🔑 Nouveau mot de passe</h1>

      {loading ? (
        <p>Chargement en cours...</p>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      ) : success ? (
        <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
          ✅ Mot de passe modifié. Redirection...
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Adresse associée :</label>
            <div className="font-semibold">{email}</div>
          </div>

          <div>
            <label className="block text-sm mb-1">Nouveau mot de passe :</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Confirmer le mot de passe :</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded"
          >
            Valider
          </button>
        </div>
      )}
    </div>
  )
}
