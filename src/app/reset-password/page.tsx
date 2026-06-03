'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '../../lib/supabaseBrowser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')

useEffect(() => {
  const checkUser = async () => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      // 1) Si Supabase renvoie ?code=..., on tente de l'échanger contre une session
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            setError(
              `EXCHANGE ERROR : ${JSON.stringify({
                message: exchangeError.message,
                status: exchangeError.status,
                name: exchangeError.name,
                code: exchangeError.code,
              })}`
            )
            setLoading(false)
            return
          }

        // Pour le test, on NE nettoie PAS l'URL tout de suite
        // window.history.replaceState({}, document.title, '/reset-password')
      }

      // 2) On vérifie si une session existe
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        setError(`SESSION ERROR : ${sessionError.message}`)
        setLoading(false)
        return
      }

      if (!sessionData.session) {
        setError('SESSION=NULL')
        setLoading(false)
        return
      }

      // 3) On vérifie si Supabase connaît bien l'utilisateur
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        setError(`USER=NULL : ${error?.message ?? 'pas de message'}`)
        setLoading(false)
        return
      }

      // 4) Tout est bon, on affiche le formulaire
      setEmail(data.user.email || '')
      setError('')
    } catch (err) {
      setError(`CATCH ERROR : ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  checkUser()
}, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError("Erreur lors de la mise à jour du mot de passe.")
    } else {
      setError('')
      setSuccess(true)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <h1 className="text-2xl font-bold mb-4 flex items-center">
        <span className="mr-2">🔑</span> Nouveau mot de passe
      </h1>

      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      ) : success ? (
        <div className="bg-green-100 text-green-700 px-4 py-3 rounded mb-4">
          Mot de passe mis à jour avec succès !
          <button
            onClick={() => router.push('/connexion')}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Retour à la connexion
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-sm">
            <p className="mb-1">Adresse associée :</p>
            <p className="font-semibold">{email}</p>
          </div>

          <div className="mb-4">
            <label className="block mb-1">Nouveau mot de passe :</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <div className="mb-4">
            <label className="block mb-1">Confirmer le mot de passe :</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full"
          >
            Valider
          </button>
        </form>
      )}
    </div>
  )
}
