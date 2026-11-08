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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pseudoConflictUserId, setPseudoConflictUserId] = useState<string | null>(null);
  const [pseudoConflictValue, setPseudoConflictValue] = useState('');
  const [pseudoConflictError, setPseudoConflictError] = useState('');
  const [isSavingConflictPseudo, setIsSavingConflictPseudo] = useState(false);
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
    if (isSubmitting) return;
    setMessage('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setMessage("Veuillez entrer une adresse email valide (ex : nom@gmail.com).");
      return;
    }
    if (email.trim() !== confirmEmail.trim()) {
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

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setMessage("Le pseudo doit contenir au moins 3 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: isUsernameAvailable, error: availabilityError } = await supabase.rpc(
        'peps_is_email_username_available',
        { p_username: cleanUsername }
      );

      if (availabilityError) {
        console.error('Erreur vérification disponibilité pseudo :', availabilityError);
        setMessage("Impossible de vérifier la disponibilité du pseudo. Réessaie.");
        return;
      }
      if (!isUsernameAvailable) {
        setMessage("Ce pseudo est déjà utilisé. Choisis-en un autre.");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            peps_signup: true,
            username: cleanUsername,
            avatar: avatar || null,
          },
        },
      });

      if (signUpError) {
        console.error('Erreur signUp :', signUpError);
        if (signUpError.message === "User already registered" || signUpError.code === 'email_exists') {
          setMessage("Cette adresse email est déjà utilisée.");
        } else {
          setMessage("Erreur d'inscription. Vérifie tes informations et réessaie.");
        }
        return;
      }

      if (!signUpData.user) {
        setMessage("Supabase n'a pas retourné le compte créé. Réessaie.");
        return;
      }

      const { data: createdProfile, error: profileReadError } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', signUpData.user.id)
        .maybeSingle();

      if (profileReadError || !createdProfile) {
        console.error('Erreur vérification profil créé par le trigger :', profileReadError);
        setMessage("Ton compte a été créé, mais PEPS n'a pas pu vérifier son profil. Connecte-toi et contacte le support si le problème persiste.");
        return;
      }

      if (createdProfile.username === null || createdProfile.username.trim() === '') {
        setPseudoConflictUserId(signUpData.user.id);
        setPseudoConflictValue('');
        setPseudoConflictError('');
        return;
      }

      await sendWelcomeEmail(email.trim(), createdProfile.username);
      setMessage("Compte créé ✅");
      setEmail('');
      setConfirmEmail('');
      setPassword('');
      setConfirmPassword('');
      setUsername('');
      setAvatar('');
    } catch (error) {
      console.error("Erreur inattendue pendant l'inscription :", error);
      setMessage("Une erreur réseau ou serveur a interrompu l'inscription. Réessaie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  async function sendWelcomeEmail(targetEmail: string, targetUsername: string) {
    try {
      const welcomeResponse = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, username: targetUsername }),
      });

      if (!welcomeResponse.ok) {
        const result = await welcomeResponse.json().catch(() => null);
        console.error('Erreur envoi mail de bienvenue :', result);
      }
    } catch (error) {
      console.error('Erreur appel mail de bienvenue :', error);
    }
  }

  async function handleSaveConflictPseudo() {
    if (!pseudoConflictUserId || isSavingConflictPseudo) return;

    const cleanPseudo = pseudoConflictValue.trim();
    if (cleanPseudo.length < 3) {
      setPseudoConflictError('Le pseudo doit contenir au moins 3 caractères.');
      return;
    }

    setIsSavingConflictPseudo(true);
    setPseudoConflictError('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ username: cleanPseudo })
        .eq('user_id', pseudoConflictUserId)
        .is('username', null)
        .select('username')
        .maybeSingle();

      if (error || !data) {
        console.error('Erreur enregistrement du nouveau pseudo :', error);
        setPseudoConflictError(
          error?.code === '23505'
            ? 'Ce pseudo vient également d’être pris. Choisis-en un autre.'
            : 'Impossible d’enregistrer ce pseudo. Vérifie ta connexion et réessaie.'
        );
        return;
      }

      await sendWelcomeEmail(email.trim(), data.username);
      setPseudoConflictUserId(null);
      setMessage('Compte créé ✅');
      setEmail('');
      setConfirmEmail('');
      setPassword('');
      setConfirmPassword('');
      setUsername('');
      setAvatar('');
    } catch (error) {
      console.error('Erreur inattendue lors de la sauvegarde du pseudo :', error);
      setPseudoConflictError('Une erreur réseau empêche l’enregistrement. Réessaie.');
    } finally {
      setIsSavingConflictPseudo(false);
    }
  }
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
          <div className={`mb-4 text-center ${message === 'Compte créé ✅' ? 'text-green-600' : 'text-red-600'}`} role="alert">
            {message}
          </div>
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
          disabled={isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          {isSubmitting ? 'Création en cours…' : 'Créer mon compte'}
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

      {pseudoConflictUserId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pseudo-conflict-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 id="pseudo-conflict-title" className="text-center text-xl font-bold">
              Ce pseudo vient d’être pris
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Ton compte est créé. Choisis un autre pseudo pour terminer ton inscription.
            </p>
            <input
              type="text"
              value={pseudoConflictValue}
              onChange={(e) => {
                setPseudoConflictValue(e.target.value);
                setPseudoConflictError('');
              }}
              minLength={3}
              autoFocus
              className="mt-4 w-full rounded-lg border px-3 py-3"
              aria-label="Nouveau pseudo"
            />
            {pseudoConflictError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {pseudoConflictError}
              </p>
            )}
            <button
              type="button"
              onClick={handleSaveConflictPseudo}
              disabled={isSavingConflictPseudo}
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isSavingConflictPseudo ? 'Enregistrement…' : 'Valider mon pseudo'}
            </button>
          </div>
        </div>
      )}

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
