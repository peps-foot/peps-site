'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabase } from '../../../components/SupabaseProvider';

const PEPS_ADMIN_EMAIL = 'admin@peps.foot';

type AudienceType = 'ALL' | 'COMPETITION' | 'USER';

type Competition = {
  id: string;
  name: string;
  kind: 'PUBLIC' | 'PRIVATE' | null;
  game_type: 'GRID' | 'TIERCE' | 'SUPPORTER' | null;
};

type UserOption = {
  id: string;
  username: string;
  email: string;
};

export default function AdminCommunicationPage() {
  const supabase = useSupabase();
  const router = useRouter();

  // ── Vérification de l'accès ──
  const [checkingAccess, setCheckingAccess] = useState(true);

  // ── Formulaire ──
  const [audienceType, setAudienceType] =
    useState<AudienceType>('COMPETITION');

  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // ── Données ──
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // ── Recherche utilisateur ──
  const [userSearch, setUserSearch] = useState('');

  // ── Fenêtre de confirmation ──
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Pour l'instant, ce compteur est uniquement visuel.
  const [recipientCount, setRecipientCount] = useState(0);
  const [loadingRecipientCount, setLoadingRecipientCount] = useState(false);

  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Vérifier que l'utilisateur est bien admin ──
  useEffect(() => {
    async function checkAdminAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const userEmail = user?.email?.toLowerCase();

      if (userEmail !== PEPS_ADMIN_EMAIL) {
        router.replace('/');
        return;
      }

      setCheckingAccess(false);
    }

    checkAdminAccess();
  }, [router, supabase]);

  // ── Charger les compétitions publiques ──
  useEffect(() => {
    async function loadPublicCompetitions() {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, kind, game_type')
        .eq('kind', 'PUBLIC')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement compétitions :', error);
        return;
      }

      setCompetitions((data || []) as Competition[]);
    }

    loadPublicCompetitions();
  }, [supabase]);

  // Pour chercher les users
  useEffect(() => {
    if (audienceType !== 'USER') {
      return;
    }

    const search = userSearch.trim();

    if (search.length < 2 || selectedUserId) {
      setUsers([]);
      setSearchingUsers(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingUsers(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setUsers([]);
          return;
        }

        const response = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(search)}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error(
            'Erreur recherche utilisateur :',
            result.error
          );

          setUsers([]);
          return;
        }

        setUsers(result.users || []);
      } catch (error) {
        console.error(
          'Erreur recherche utilisateur :',
          error
        );

        setUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    audienceType,
    userSearch,
    selectedUserId,
    supabase,
  ]);

  const selectedUser = users.find(
    (user) => user.id === selectedUserId
  );

  const selectedCompetition = competitions.find(
    (competition) => competition.id === selectedCompetitionId
  );

  // ── Compteur d'utilisateurs ──
  useEffect(() => {
    const competitionIsMissing =
      audienceType === 'COMPETITION' && !selectedCompetitionId;

    const userIsMissing =
      audienceType === 'USER' && !selectedUserId;

    if (competitionIsMissing || userIsMissing) {
      setRecipientCount(0);
      setLoadingRecipientCount(false);
      return;
    }

    let cancelled = false;

    async function loadRecipientCount() {
      setLoadingRecipientCount(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setRecipientCount(0);
          }

          return;
        }

        const response = await fetch(
          '/api/admin/communication/count-recipients',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              audience: audienceType,
              competitionId:
                audienceType === 'COMPETITION'
                  ? selectedCompetitionId
                  : undefined,
              userId:
                audienceType === 'USER'
                  ? selectedUserId
                  : undefined,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          console.error(
            'Erreur compteur destinataires :',
            result.error
          );

          if (!cancelled) {
            setRecipientCount(0);
          }

          return;
        }

        if (!cancelled) {
          setRecipientCount(result.count || 0);
        }
      } catch (error) {
        console.error(
          'Erreur compteur destinataires :',
          error
        );

        if (!cancelled) {
          setRecipientCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipientCount(false);
        }
      }
    }

    loadRecipientCount();

    return () => {
      cancelled = true;
    };
  }, [
    audienceType,
    selectedCompetitionId,
    selectedUserId,
    supabase,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (audienceType === 'COMPETITION' && !selectedCompetitionId) {
      alert('Choisis une compétition.');
      return;
    }

    if (audienceType === 'USER' && !selectedUserId) {
      alert('Choisis un utilisateur.');
      return;
    }

    if (!subject.trim()) {
      alert('L’objet du mail est obligatoire.');
      return;
    }

    if (!message.trim()) {
      alert('Le message est obligatoire.');
      return;
    }

    setShowConfirmModal(true);
  }

  async function handleFakeSend() {
    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert('Tu n’es plus connecté.');
        return;
      }

      const response = await fetch('/api/admin/communication/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject,
          message,
          audience: audienceType,
          competitionId:
            audienceType === 'COMPETITION'
              ? selectedCompetitionId
              : undefined,
          userId:
            audienceType === 'USER'
              ? selectedUserId
              : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erreur pendant l’envoi.');
        return;
      }

      setShowConfirmModal(false);

      alert(
        `Mail envoyé à ${result.sentCount ?? recipientCount} destinataire(s).`
      );
    } catch (error) {
      console.error('Erreur envoi :', error);
      alert('Impossible d’envoyer le mail.');
    } finally {
      setSending(false);
    }
  }

  if (checkingAccess) {
    return (
      <div className="p-6 text-center">
        Vérification de l’accès…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">

      {/* ── Navigation entre les zones admin ── */}
      <div className="mb-6 flex justify-center gap-3">
        <Link
          href="/admin/grids"
          className="rounded-lg border border-blue-600 px-4 py-2 font-semibold text-blue-600 hover:bg-blue-50"
        >
          Gestion PEPS
        </Link>

        <Link
          href="/admin/communication"
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
        >
          Communication
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            Communication PEPS
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Prépare un message à destination des joueurs de PEPS.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* ── Type de destinataires ── */}
          <div>
            <label className="mb-1 block font-medium">
              Groupe de destinataires
            </label>

            <select
              value={audienceType}
              onChange={(event) => {
                const value = event.target.value as AudienceType;

                setAudienceType(value);
                setSelectedCompetitionId('');
                setSelectedUserId('');
                setUserSearch('');
              }}
              className="w-full rounded-lg border px-3 py-3"
            >
              <option value="COMPETITION">
                Une compétition publique
              </option>

              <option value="ALL">
                Tous les joueurs
              </option>

              <option value="USER">
                Une personne précise
              </option>
            </select>
          </div>

          {/* ── Choix d'une compétition publique ── */}
          {audienceType === 'COMPETITION' && (
            <div>
              <label className="mb-1 block font-medium">
                Compétition
              </label>

              <select
                value={selectedCompetitionId}
                onChange={(event) =>
                  setSelectedCompetitionId(event.target.value)
                }
                className="w-full rounded-lg border px-3 py-3"
              >
                <option value="">
                  — Choisir une compétition —
                </option>

                {competitions.map((competition) => (
                  <option
                    key={competition.id}
                    value={competition.id}
                  >
                    {competition.name}
                    {competition.game_type
                      ? ` — ${competition.game_type}`
                      : ''}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Seules les compétitions publiques sont proposées.
              </p>
            </div>
          )}

          {/* ── Recherche d'un utilisateur ── */}
          {audienceType === 'USER' && (
            <div>
              <label className="mb-1 block font-medium">
                Rechercher un utilisateur
              </label>

              <input
                type="text"
                value={userSearch}
                onChange={(event) => {
                  setUserSearch(event.target.value);
                  setSelectedUserId('');
                }}
                className="w-full rounded-lg border px-3 py-3"
                placeholder="Tape un pseudo ou une adresse e-mail…"
              />

              {userSearch.trim().length === 1 && (
                <p className="mt-2 text-xs text-gray-500">
                  Tape au moins deux caractères.
                </p>
              )}

              {userSearch.trim().length >= 2 && !selectedUserId && (
                <div className="mt-2 overflow-hidden rounded-lg border bg-white">
                  {searchingUsers ? (
                    <div className="px-3 py-3 text-sm text-gray-500">
                      Recherche en cours…
                    </div>
                  ) : users.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-gray-500">
                      Aucun utilisateur trouvé.
                    </div>
                  ) : (
                    users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setUserSearch(user.username);
                        }}
                        className="block w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="font-medium">
                          {user.username}
                        </div>

                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {userSearch.trim().length === 1 && (
                <p className="mt-2 text-xs text-gray-500">
                  Tape au moins deux caractères.
                </p>
              )}

              {selectedUser && (
                <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  Destinataire sélectionné :
                  <strong> {selectedUser.username}</strong>
                </div>
              )}
            </div>
          )}

          {/* ── Compteur ── */}
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="text-sm text-blue-700">
              Nombre estimé de destinataires
            </div>

            <div className="mt-1 text-2xl font-bold text-blue-900">
              {loadingRecipientCount ? 'Calcul…' : recipientCount}
            </div>

            <p className="mt-1 text-xs text-blue-700">
              Comptes disposant d’une adresse e-mail.
            </p>
          </div>

          {/* ── Objet ── */}
          <div>
            <label className="mb-1 block font-medium">
              Objet du mail
            </label>

            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-lg border px-3 py-3"
              placeholder="Ex : La nouvelle grille PEPS est disponible"
            />
          </div>

          {/* ── Corps du mail ── */}
          <div>
            <label className="mb-1 block font-medium">
              Message
            </label>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={10}
              className="w-full rounded-lg border px-3 py-3"
              placeholder="Écris ton message ici…"
            />

            <div className="mt-1 text-right text-xs text-gray-500">
              {message.length} caractère
              {message.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* ── Bouton Envoyer ── */}
          <button
            type="submit"
            disabled={recipientCount === 0}
            className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Préparer l’envoi
          </button>
        </form>
      </div>

      {/* ── Fenêtre de confirmation ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">
              Confirmer l’envoi
            </h2>

            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <p>
                Tu vas envoyer ce mail à :
              </p>

              <div className="rounded-xl bg-blue-50 p-4 text-center">
                <div className="text-3xl font-bold text-blue-900">
                  {recipientCount}
                </div>

                <div className="text-blue-700">
                  destinataire
                  {recipientCount > 1 ? 's' : ''}
                </div>
              </div>

              {audienceType === 'COMPETITION' &&
                selectedCompetition && (
                  <p>
                    Compétition :
                    <strong> {selectedCompetition.name}</strong>
                  </p>
                )}

              {audienceType === 'USER' && selectedUser && (
                <p>
                  Utilisateur :
                  <strong> {selectedUser.username}</strong>
                </p>
              )}

              {audienceType === 'ALL' && (
                <p>
                  Groupe :
                  <strong> Tous les joueurs</strong>
                </p>
              )}

              <p>
                Objet :
                <strong> {subject}</strong>
              </p>

              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="mb-1 font-medium">
                  Aperçu du message
                </div>

                <div className="max-h-40 overflow-auto whitespace-pre-wrap text-gray-600">
                  {message}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 rounded-lg border px-4 py-3 font-semibold hover:bg-gray-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleFakeSend}
                disabled={sending}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Envoi…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}