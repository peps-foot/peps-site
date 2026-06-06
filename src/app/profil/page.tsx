'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '../../components/SupabaseProvider'

type Team = {
  id: number;
  name: string;
  logo: string;
};

export default function ProfilPage() {
  const supabase = useSupabase()
  const [userEmail, setUserEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('')

  // Pour l'avatar
  const [avatar, setAvatar] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarSearch, setAvatarSearch] = useState('')
  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(avatarSearch.toLowerCase())
  )

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserEmail(user.email || '')

        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('user_id', user.id)
          .single()
        
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, logo')
          .order('name')

        if (teamsData) {
          setTeams(teamsData)
        }

        if (profile?.username) {
          setPseudo(profile.username)
        }

        if (profile?.avatar) {
          setAvatar(profile.avatar)
        }
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSuccessMessage('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsSaving(false)
      return
    }

    // 🔁 Changement d'e-mail (sans confirmation)
    if (user.email !== userEmail) {
      const { data, error: emailError } = await supabase.auth.updateUser({
        email: userEmail,
      })

      console.log("UPDATE EMAIL", { data, emailError })
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
      .update({
        username: pseudo,
        avatar: avatar,
      })
      .eq('user_id', user.id)

    if (profileError) {
      alert("Erreur lors de la mise à jour du profil.")
      setIsSaving(false)
      return
    }

    setSuccessMessage('Changements validés ✅')

    setTimeout(() => {
      setSuccessMessage((prev) => (prev ? '' : prev))
    }, 3000)
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

      {/* Infos personnelles */}
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-bold border-b pb-1">Infos personnelles :</h2>

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

        {/* Changements de MDP */}
        <h2 className="text-lg font-bold border-b pb-1">Pour changer de mot de passe :</h2>

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

        {/* Avatar */}
        <h2 className="text-lg font-bold border-b pb-1">Avatar :</h2>

        <div className="flex items-center justify-between py-3">
          <button
            type="button"
            onClick={() => setShowAvatarModal(true)}
            className="text-blue-600 underline text-sm"
          >
            Changer d’avatar
          </button>

          <img
            src={avatar || "/images/default-avatar.png"}
            alt="avatar"
            className="w-14 h-14 rounded-full border object-contain bg-white"
          />
        </div>

        {/* Valider les changements sur la page */}
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
            {successMessage && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold">
                {successMessage}
              </div>
            )}
        </div>

        {/* Se déconnecter */}
        <div className="mt-6 text-center">
          <button
            onClick={handleSignOut}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Se déconnecter
          </button>
        </div>
        </div>

        {/* POP UP Avatar */}
        {showAvatarModal && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
            onClick={() => setShowAvatarModal(false)}
          >
            <div
              className="bg-white rounded-lg p-4 w-full max-w-md max-h-[80vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Croix fermeture */}
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-black text-xl"
              >
                ✕
              </button>

              <h2 className="text-lg font-bold mb-3 text-center">
                Choisis ton équipe
              </h2>

              <input
                type="text"
                value={avatarSearch}
                onChange={(e) => setAvatarSearch(e.target.value)}
                placeholder="Rechercher une équipe..."
                className="w-full border px-3 py-2 rounded mb-4"
              />

              <div className="grid grid-cols-4 gap-3">
                {filteredTeams.map((team) => (
                  <button
                    type="button"
                    key={team.id}
                    onClick={() => {
                      setAvatar(team.logo)
                      setShowAvatarModal(false)
                    }}
                    className="border rounded p-2 flex items-center justify-center"
                  >
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="w-10 h-10 object-contain"
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="mt-4 w-full bg-gray-200 py-2 rounded"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

      </div>
  )
}
