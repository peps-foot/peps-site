'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider';
import supabaseReset from '../../lib/supabaseResetClient'

export default function ConnexionPage() {
  const supabase = useSupabase();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [remember, setRemember] = useState(false);

  // Pour les lien vers les applis
  const [showIosModal, setShowIosModal] = useState(false);
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.peps_foot.www.twa&utm_source=emea_Med';

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    console.log("✅ Connexion réussie, session :", data.session);
    const userEmail = data.user?.email;

    setTimeout(() => {
      if (userEmail === 'admin@peps.foot') {
        router.push('/admin/grids');
      } else {
        router.push('/');
      }
    }, 200);
  }

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg('Veuillez d’abord saisir votre email ci-dessus.');
      return;
    }

      const { error } = await supabaseReset.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.peps-foot.com/reset-password',
      })
    if (error) {
      setErrorMsg(error.message);
    } else {
      setInfoMsg('Un email de récupération vient de vous être envoyé.');
    }
  }

return (
  <div className="max-w-md mx-auto p-6 space-y-6 text-center">
    <img
      src="/images/connexion/logo_peps_connexion.png"
      alt="Logo PEPS"
      className="mx-auto mb-6 w-full max-w-md"
    />

    <form onSubmit={handleLogin} className="space-y-4 text-left">
      <div>
        <label className="block mb-1">Email</label>
        <input
          type="email"
          className="w-full border rounded px-2 py-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block mb-1">Mot de passe</label>
        <input
          type="password"
          className="w-full border rounded px-2 py-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
      {infoMsg && <div className="text-green-600 text-sm">{infoMsg}</div>}

      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
      >
        Se connecter
      </button>
      <div className="flex justify-center items-center mt-2 mb-4">
        <input
          id="remember"
          type="checkbox"
          className="mr-2"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <label htmlFor="remember" className="text-gray-700">
          Rester connecté
        </label>
      </div>
    </form>

    <div className="mt-6 space-y-3 max-w-md mx-auto text-sm">
      {/* LIGNE 1 */}
      <div className="grid grid-cols-2 items-center gap-2 text-center">
        <span>Tu veux jouer ?</span>
        <button
          onClick={() => router.push('/inscription')}
          className="bg-green-500 text-white font-semibold py-1 px-2 rounded w-full whitespace-nowrap text-sm"
        >
          Inscription en 30s
        </button>
      </div>

      {/* LIGNE 2 */}
      <div className="grid grid-cols-2 items-center gap-2 text-center">
        <span>Mot de passe oublié ?</span>
        <button
          onClick={handleForgotPassword}
          className="bg-gray-500 text-white font-semibold py-1 px-2 rounded w-full"
        >
          Clique ici !
        </button>
      </div>

      {/* LIGNE 3 */}
      <div className="grid grid-cols-2 items-center gap-2 text-center">
        <span>Les règles du jeu ?</span>
        <button
          onClick={() => router.push('/regles_connexion')}
          className="bg-blue-700 text-white font-semibold py-1 px-2 rounded w-full"
        >
          Bonne lecture
        </button>
      </div>
    </div>

    {/* INSTALLATION MOBILE */}
    <div className="mt-6 flex justify-center items-center gap-6">
      
      {/* ANDROID */}
      <button
        onClick={() => window.open(PLAY_STORE_URL, '_blank')}
        className="hover:scale-105 transition"
        aria-label="Télécharger PEPS sur Android"
      >
        <img
          src="/images/connexion/android.png"
          alt="Android"
          className="w-16 h-16 object-contain"
        />
      </button>

      {/* IOS */}
      <button
        onClick={() => setShowIosModal(true)}
        className="hover:scale-105 transition"
        aria-label="Installer PEPS sur iPhone"
      >
        <img
          src="/images/connexion/ios.png"
          alt="iPhone"
          className="w-16 h-16 object-contain"
        />
      </button>

    </div>

    <p className="mt-6 text-sm text-gray-600">
      Pour nous contacter :{" "} <a href="mailto:hello@peps-foot.com" 
        className="underline text-blue-600 hover:text-blue-800">
        hello@peps-foot.com
      </a>
    </p>

    {/* POP-UP iOs */}
    {showIosModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-xl p-5 max-w-sm w-full text-center shadow-lg">
          <h2 className="text-lg font-bold mb-3">Installer PEPS sur iPhone</h2>

          <div className="text-sm text-left space-y-2 text-gray-700">
            <p>1. Ouvre PEPS avec <strong>Safari</strong>.</p>
            <p>2. Appuie sur le bouton <strong>Partager</strong>.</p>
            <p>3. Choisis <strong>Sur l’écran d’accueil</strong>.</p>
            <p>4. Valide avec <strong>Ajouter</strong>.</p>
          </div>

          <p className="text-sm mt-4 text-orange-600 font-semibold">
            L’application iOS officielle arrive bientôt 🚀
          </p>

          <button
            onClick={() => setShowIosModal(false)}
            className="mt-4 w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
          >
            J’ai compris
          </button>
        </div>
      </div>
    )}

  </div>
);
}
