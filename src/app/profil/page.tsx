'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../../components/SupabaseProvider'

export default function ProfilPage() {
  const supabase = useSupabase()
  const [userEmail, setUserEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (pseudo.length < 3 || pseudo.length > 15) {
      alert('Le pseudo doit contenir entre 3 et 15 caractères.')
      return
    }

    if (newPassword.length > 0) {
      if (newPassword.length < 6) {
        alert('Le mot de passe doit contenir au moins 6 caractères.')
        return
      }
      if (newPassword !== confirmPassword) {
        alert('Les deux mots de passe ne correspondent pas.')
        return
      }

      const { error: pwError } = await supabase.auth.updateUser({
        password: newPassword
      })
      if (pwError) {
        alert("Erreur lors du changement de mot de passe.")
        return
      }
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username: pseudo })
      .eq('user_id', user.id)

    if (profileError) {
      alert("Erreur lors de la mise à jour du profil.")
      return
    }

    alert('Modifications enregistrées.')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleDelete = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('delete_user', { uid: user.id })
    if (error) {
      alert('Erreur lors de la suppression.')
    } else {
      alert('Compte supprimé. À bientôt !')
      await supabase.auth.signOut()
      useEffect(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/connexion';
        }
      }, []);
    }
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
            disabled
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
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Confirmer le mot de passe :</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div className="flex justify-center mt-4">
          <button
            onClick={handleSave}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Valider les changements
          </button>
        </div>

        <div className="mt-10 text-center text-sm text-gray-700">
          Pour nous contacter : <a href="mailto:hello@peps-foot.com" className="text-blue-600 underline">hello@peps-foot.com</a>
          <div className="mt-6">
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
