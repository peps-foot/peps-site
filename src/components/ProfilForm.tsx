// src/components/ProfilForm.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProfilFormProps {
  initialEmail: string;
  initialPseudo: string;
}

export default function ProfilForm({
  initialEmail,
  initialPseudo,
}: ProfilFormProps) {
  const router = useRouter();

  // États pour le formulaire
  const [email, setEmail] = useState(initialEmail);
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // États pour le modal de suppression
  const [showModal, setShowModal] = useState(false);
  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  // Soumission du formulaire de MAJ de profil
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    // Validation mot de passe
    if (newPassword || confirmPassword) {
      if (newPassword.length < 6) {
        setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    // Construction du payload
    const payload: {
      email?: string;
      password?: string;
      pseudo: string;
    } = { pseudo };
    if (email !== initialEmail) payload.email = email;
    if (newPassword) payload.password = newPassword;

    console.log('→ Payload envoyé à /api/profile/update :', payload);

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log('← Réponse de /api/profile/update :', res.status, data);

      // Cas rate-limit email
      if (!res.ok && data.error === 'email rate limit exceeded') {
        setErrorMsg(
          "Vous avez récemment changé d'adresse mail ; attendez un peu."
        );
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Erreur mise à jour');
      }

      setInfoMsg('Profil mis à jour avec succès !');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  // Suppression du compte
  async function handleDelete() {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur suppression');
      }
      router.push('/connexion');
    } catch (err: any) {
      setErrorMsg(err.message);
      closeModal();
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Infos personnelles</h1>

      {/* Formulaire de mise à jour */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block mb-1 font-medium">Mail</label>
          <input
            type="email"
            className="w-full border rounded px-2 py-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Pseudo */}
        <div>
          <label className="block mb-1 font-medium">Pseudo</label>
          <input
            type="text"
            className="w-full border rounded px-2 py-1"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
          />
        </div>

        {/* Mot de passe */}
        <h2 className="text-xl font-semibold mt-6">
          Changement de mot de passe
        </h2>
        <div>
          <label className="block mb-1 font-medium">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            className="w-full border rounded px-2 py-1"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Laisser vide pour ne pas changer"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Confirmer mot de passe</label>
          <input
            type="password"
            className="w-full border rounded px-2 py-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Répétez le mot de passe"
          />
        </div>

        {/* Messages d’erreur ou d’info */}
        {errorMsg && <p className="text-red-600">{errorMsg}</p>}
        {infoMsg && <p className="text-green-600">{infoMsg}</p>}

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Valider les changements
        </button>
      </form>

      {/* Bouton rouge SUPPRIMER MON COMPTE */}
      <div className="mt-8">
        <button
          onClick={openModal}
          className="w-full bg-red-600 text-white font-bold py-2 rounded hover:bg-red-700"
        >
          SUPPRIMER MON COMPTE
        </button>
      </div>

      {/* Modal de confirmation */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden w-11/12 max-w-md">
            {/* Croix pour fermer */}
            <div className="flex justify-end p-2">
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-lg">
                Êtes-vous sûr de vouloir supprimer votre compte définitivement ?
              </p>
              {errorMsg && <p className="text-red-600">{errorMsg}</p>}
            </div>
            <div className="flex justify-end space-x-4 p-4 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded border hover:bg-gray-100"
              >
                Je garde mon compte
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
