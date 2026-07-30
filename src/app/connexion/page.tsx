'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabase } from '../../components/SupabaseProvider';
import supabaseReset from '../../lib/supabaseResetClient'

const PEPS_ADMIN_EMAIL = 'admin@peps.foot';
const COINCHE_ADMIN_EMAIL = 'admin@coinche.com';

export default function ConnexionPage() {
  const supabase = useSupabase();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [remember, setRemember] = useState(false);

  // pop-up mdp oublié
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState<string | null>(null);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  // image "comment jouer"
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);

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
      switch (error.message) {
        case "Invalid login credentials":
          setErrorMsg("Adresse e-mail ou mot de passe incorrect.");
          break;

        case "Email not confirmed":
          setErrorMsg("Ton adresse e-mail n'a pas encore été confirmée.");
          break;

        default:
          setErrorMsg("Une erreur est survenue. Merci de réessayer.");
      }

      return;
    }

    console.log("✅ Connexion réussie, session :", data.session);
    const userEmail = data.user?.email;

    setTimeout(() => {
      if (userEmail === PEPS_ADMIN_EMAIL) {
        router.replace('/admin/grids');
      } else if (userEmail === COINCHE_ADMIN_EMAIL) {
        router.replace('/coinche');
      } else {
        router.replace('/');
      }
    }, 200);
  }

  // pour se connecter avec Google
  async function handleGoogleLogin() {
    setErrorMsg(null)
    setInfoMsg(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      console.error("Erreur connexion Google :", error)
      setErrorMsg("Impossible de se connecter avec Google.")
    }
  }

  // pour le mdp oublié
  async function handleForgotPassword() {
    setForgotPasswordError(null);
    setForgotPasswordMsg(null);

    const cleanEmail = forgotPasswordEmail.trim();

    if (!cleanEmail) {
      setForgotPasswordError("Veuillez saisir votre adresse e-mail.");
      return;
    }

    setForgotPasswordLoading(true);

    const { error } = await supabaseReset.auth.resetPasswordForEmail(
      cleanEmail,
      {
        redirectTo: "https://www.peps-foot.com/reset-password",
      }
    );

    setForgotPasswordLoading(false);

    if (error) {
      setForgotPasswordError(
        "Une erreur est survenue. Veuillez réessayer dans quelques instants."
      );
      return;
    }

    setForgotPasswordMsg(
      "Demande envoyée. Si cette adresse correspond à un compte PEPS, vous recevrez un e-mail de récupération."
    );
  }

return (
  <div className="max-w-md mx-auto p-6 space-y-4 text-center">
    <img
      src="/images/connexion/logo_peps_connexion.png"
      alt="Logo PEPS"
      className="mx-auto w-full max-w-md"
    />

    <form onSubmit={handleLogin} className="space-y-4 text-left">
      <input
        type="email"
        placeholder="Adresse e-mail"
        className="w-full border border-gray-300 rounded px-3 py-3"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Mot de passe"
        className="w-full border border-gray-300 rounded px-3 py-3"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {errorMsg && <div className="text-red-600 text-sm">{errorMsg}</div>}
      {infoMsg && <div className="text-green-600 text-sm">{infoMsg}</div>}

      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
      >
        Se connecter
      </button>

      <div className="flex justify-center items-center">
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

    <p className="text-sm text-gray-400">
      ou
    </p>

    <button
      type="button"
      onClick={handleGoogleLogin}
      className="w-full border border-gray-300 bg-white py-2 rounded flex items-center justify-center gap-3 hover:bg-gray-50"
    >
      <img
        src="/images/connexion/google-logo.png"
        alt="Google"
        className="w-5 h-5"
      />

      <span className="font-medium text-gray-700">
        Se connecter avec Google
      </span>
    </button>

    <div className="my-5 border-t border-gray-200" />

    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => router.push("/inscription")}
        className="h-16 rounded-xl bg-green-500 px-1 text-white transition hover:bg-green-600"
      >
        <span className="block whitespace-nowrap text-sm font-bold">
          Inscris-toi
        </span>
        <span className="block text-xs font-medium">
          en 30 s
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          setForgotPasswordEmail("");
          setForgotPasswordMsg(null);
          setForgotPasswordError(null);
          setShowForgotPasswordModal(true);
        }}
        className="h-16 rounded-xl bg-gray-500 px-1 text-white transition hover:bg-gray-600"
      >
        <span className="block whitespace-nowrap text-xs font-bold">
          Mot de passe
        </span>
        <span className="block text-xs font-medium">
          oublié
        </span>
      </button>

      <button
        type="button"
        onClick={() => setShowHowToPlayModal(true)}
        className="h-16 rounded-xl bg-blue-600 px-1 text-white transition hover:bg-blue-700"
      >
        <span className="block text-sm font-bold">
          Comment
        </span>
        <span className="block text-sm font-bold">
          jouer ?
        </span>
      </button>
    </div>
    
    <div className="my-5 border-t border-gray-200" />

    {/* INSTALLATION MOBILE */}
    <div className="text-center">
      <p className="mb-3 text-sm font-semibold text-gray-700">
        📱 Télécharger l'application PEPS
      </p>

      <div className="flex justify-center items-start gap-8">
        {/* ANDROID */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => window.open(PLAY_STORE_URL, "_blank")}
            className="hover:scale-105 transition"
            aria-label="Télécharger PEPS sur Android"
          >
            <img
              src="/images/connexion/android.png"
              alt="Android"
              className="w-16 h-16 object-contain"
            />
          </button>

          <span className="mt-1 text-sm font-medium text-gray-600">
            Android
          </span>
        </div>

        {/* IOS */}
        <div className="flex flex-col items-center">
          <button
            type="button"
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

          <span className="mt-1 text-sm font-medium text-gray-600">
            iPhone
          </span>
        </div>
      </div>
    </div>

    <p className="text-sm text-gray-600">
      Pour nous contacter :{" "} <a href="mailto:hello@peps-foot.com" 
        className="underline text-blue-600 hover:text-blue-800">
        hello@peps-foot.com
      </a>
    </p>

    {/* POP-UP iOs */}
    {showIosModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
        <div className="bg-white rounded-xl p-5 max-w-sm w-full text-center shadow-lg">
          <h2 className="text-lg font-bold mb-3">Installer l'application web sur iPhone</h2>

          <div className="text-sm text-left space-y-2 text-gray-700">
            <p>1. Ouvre PEPS avec <strong>Safari</strong>.</p>
            <p>2. Appuie sur le bouton <strong>Partager</strong>.</p>
            <p>3. Choisis <strong>Sur l’écran d’accueil</strong>.</p>
            <p>4. Valide avec <strong>Ajouter</strong>.</p>
          </div>

          <p className="text-sm mt-4 text-orange-600 font-semibold">
            L’application iOS officielle arrivera plus tard 🚀
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

    {/* POP-UP récup mot de passe */}
    {showForgotPasswordModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
          <button
            type="button"
            onClick={() => setShowForgotPasswordModal(false)}
            className="absolute right-4 top-3 text-2xl leading-none text-gray-500 hover:text-gray-800"
            aria-label="Fermer"
          >
            ×
          </button>

          <h2 className="mb-2 pr-8 text-center text-xl font-bold text-gray-800">
            Mot de passe oublié
          </h2>

          <p className="mb-4 text-center text-sm text-gray-600">
            Saisissez l’adresse e-mail utilisée pour votre compte PEPS.
          </p>

          <input
            type="email"
            value={forgotPasswordEmail}
            onChange={(e) => {
              setForgotPasswordEmail(e.target.value);
              setForgotPasswordError(null);
              setForgotPasswordMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleForgotPassword();
              }
            }}
            placeholder="Adresse e-mail"
            className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            autoFocus
          />

          {forgotPasswordError && (
            <p className="mt-3 text-center text-sm text-red-600">
              {forgotPasswordError}
            </p>
          )}

          {forgotPasswordMsg && (
            <p className="mt-3 text-center text-sm text-green-600">
              {forgotPasswordMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={forgotPasswordLoading || Boolean(forgotPasswordMsg)}
            className="mt-4 w-full rounded-lg bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {forgotPasswordLoading ? "Envoi en cours..." : "Envoyer"}
          </button>
        </div>
      </div>
    )}

    {/* POP-UP Comment jouer */}
    {showHowToPlayModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={() => setShowHowToPlayModal(false)}
      >
        <div
          className="relative w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Croix */}
          <button
            type="button"
            onClick={() => setShowHowToPlayModal(false)}
            className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl text-gray-700 shadow hover:bg-gray-100"
            aria-label="Fermer"
          >
            ×
          </button>

          {/* Image */}
          <img
            src="/images/bannieres/presentation.png"
            alt="Comment jouer à PEPS"
            className="w-full rounded-2xl shadow-2xl"
          />
        </div>
      </div>
    )}

  </div>
);
}
