'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../../components/SupabaseProvider'

export default function ProfilPage() {
  const supabase = useSupabase()
  const [userEmail, setUserEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .single()

        if (profile?.username) {
          setPseudo(profile.username)
        }
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsSaving(false)
      return
    }

    // 🔁 Changement d'e-mail (sans confirmation)
    if (user.email !== userEmail) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: userEmail,
      })

      if (emailError) {
        alert("Erreur lors du changement d'adresse e-mail.")
        setIsSaving(false)
        return
      }
    }

    // 🔎 Vérification du pseudo
    if (pseudo.length < 3 || pseudo.length > 15) {
      alert('Le pseudo doit contenir entre 3 et 15 caractères.')
      setIsSaving(false)
      return
    }

    // 🔐 Mise à jour du mot de passe
    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        alert('Le mot de passe doit contenir au moins 6 caractères.')
        setIsSaving(false)
        return
      }
      if (newPassword !== confirmPassword) {
        alert('Les deux mots de passe ne correspondent pas.')
        setIsSaving(false)
        return
      }

      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword
      })
      if (pwError) {
        alert("Erreur lors du changement de mot de passe.")
        setIsSaving(false)
        return
      }
    }

    // 📝 Mise à jour du pseudo dans 'profiles'
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: pseudo })
      .eq('user_id', user.id)

    if (profileError) {
      alert("Erreur lors de la mise à jour du profil.")
      setIsSaving(false)
      return
    }

    alert('Modifications enregistrées.')
    setNewPassword('')
    setConfirmPassword('')
    setIsSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/connexion';
  };

  return (
    <div className="min-h-screen bg-white px-4 py-6">

      <div className="max-w-xl mx-auto space-y-6">
        <h2 className="text-xl font-bold border-b pb-2">Infos personnelles :</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Mail :</label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pseudo :</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full border px-3 py-2 rounded"
            placeholder="Entre 3 et 15 caractères"
          />
        </div>

        <h2 className="text-xl font-bold border-b pb-2">Changement de mot de passe :</h2>

        <div>
          <label className="block text-sm mb-1">Nouveau mot de passe :</label>
          <input
            type="password"
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Confirmer le mot de passe :</label>
          <input
            type="password"
            autoComplete="new-password"
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmer le mot de passe"
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div className="flex justify-center mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 rounded text-white transition ${
              isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isSaving ? 'Chargement...' : 'Valider les changements'}
          </button>
        </div>
          <div className="mt-6 text-center">
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
  )
}
