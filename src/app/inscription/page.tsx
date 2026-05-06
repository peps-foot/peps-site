'use client';

import { useState, useEffect } from 'react';
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

  // Pour l'avatar
  type Team = {
    id: number
    name: string
    logo: string
  }

  const [avatar, setAvatar] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [avatarSearch, setAvatarSearch] = useState('')
  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(avatarSearch.toLowerCase())
  )

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, logo')
        .order('name', { ascending: true })

      if (error) {
        console.error('Erreur chargement teams:', error)
        return
      }

      setTeams(data || [])
    }

    fetchTeams()
  }, [supabase])

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
      .insert([{
        user_id: signUpData.user!.id,
        username: username.trim(),
        avatar: avatar || null
      }]);

    if (profileError) {
      console.error(profileError);
      setMessage("Inscrit, mais impossible de sauvegarder le pseudo.");
    } else {
      setMessage("Compte créé ✅ Pense à activer les notifications dans l’onglet NOTIFS pour recevoir les rappels.");
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

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Avatar :</label>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAvatarModal(true)}
              className="text-blue-600 underline text-sm"
            >
              Choisir une équipe (optionnel)
            </button>

            <img
              src={avatar || "/images/default-avatar.png"}
              alt="avatar"
              className="w-12 h-12 rounded-full border object-contain bg-gray-100"
            />
          </div>
        </div>

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

      {/* POP-UP pour avatar*/}
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

            <p className="text-xs text-gray-500 mb-2">
  {teams.length} équipes chargées — {filteredTeams.length} affichées
</p>

            <div className="grid grid-cols-4 gap-3">
              {filteredTeams.map((team) => (
                  <button
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
              onClick={() => setShowAvatarModal(false)}
              className="mt-4 w-full bg-gray-200 py-2 rounded"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
