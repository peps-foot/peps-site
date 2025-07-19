'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import supabase from '../../lib/supabaseBrowser'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const restoreSession = async () => {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      const type = params.get('type')

      console.log('🔍 Hash complet:', window.location.hash)
      console.log('🔐 access_token:', access_token)
      console.log('🔄 refresh_token:', refresh_token)
      console.log('📦 type:', type)

      if (access_token && refresh_token && type === 'recovery') {
        console.log('🧪 Tentative de restauration de session...')
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token
        })

        if (sessionError) {
          console.error('⛔ Erreur setSession :', sessionError)
          setError("Lien invalide ou expiré. Veuillez redemander un email.")
        } else {
          console.log('✅ Session restaurée, on récupère l’utilisateur…')
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          if (user?.email) {
            console.log('✅ Utilisateur récupéré :', user.email)
            setEmail(user.email)
            setError('')
          } else {
            console.error('⛔ Utilisateur non trouvé :', userError)
            setError("Utilisateur non trouvé. Veuillez réessayer.")
          }
        }
      } else {
        console.warn('⛔ Lien invalide ou paramètres manquants.')
        setError("Lien invalide ou expiré. Veuillez redemander un email.")
      }

      setLoading(false)
    }

    restoreSession()
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

    console.log('💾 Tentative de mise à jour du mot de passe...')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      console.error('⛔ Erreur updateUser :', error)
      setError("Erreur lors de la mise à jour du mot de passe.")
    } else {
      console.log('✅ Mot de passe mis à jour avec succès.')
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
