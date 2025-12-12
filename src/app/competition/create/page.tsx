"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../../lib/supabaseBrowser";

type SourceLeague = {
  league_id: number;
  league_name: string | null;
  grids_count: number;
};

type GridOption = {
  grid_id: string;
  title: string | null;
  first_match_at: string | null;
  league_name: string | null;
  grid_done: boolean;
};

type BonusOption = {
  code: string;
  label: string;
};

const ALL_BONUSES: BonusOption[] = [
  { code: "KANTE", label: "Kanté" },
  { code: "RIBERY", label: "Ribéry" },
  { code: "ZLATAN", label: "Zlatan" },
  { code: "BIELSA", label: "Bielsa" },
  { code: "BUTS", label: "Buts" },
  { code: "ECART", label: "Écart" },
  { code: "CLEAN SHEET", label: "Clean sheet" },
];

export default function CreateCompetitionPage() {
  const router = useRouter();

  const [sessionChecked, setSessionChecked] = useState(false);

  // Nom de la compét (max 20 chars)
  const [name, setName] = useState("");

  // Ligue de départ
  const [sources, setSources] = useState<SourceLeague[]>([]);
  const [sourceLeagueId, setSourceLeagueId] = useState<string>("");

  // Grilles de la ligue choisie
  const [grids, setGrids] = useState<GridOption[]>([]);
  const [selectedGridIds, setSelectedGridIds] = useState<Set<string>>(
    () => new Set()
  );

  // Bonus (tous cochés par défaut)
  const [selectedBonusCodes, setSelectedBonusCodes] = useState<Set<string>>(
    () => new Set(ALL_BONUSES.map((b) => b.code))
  );

  // UI
  const [message, setMessage] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Après validation de la compétition
  const [createdInfo, setCreatedInfo] = useState<{
    id: string;
    code: string;
  } | null>(null);

  // 1) Vérifier qu'on est connecté
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/connexion");
        return;
      }
      setSessionChecked(true);
    };
    check();
  }, [router]);

  // 2) Charger les ligues qui ont des grilles privées non terminées
  useEffect(() => {
    if (!sessionChecked) return;

    const loadSources = async () => {
      const { data, error } = await supabase.rpc(
        "get_private_leagues_for_templates"
      );
      if (error) {
        console.error("Erreur get_private_leagues_for_templates :", error);
        return;
      }
      setSources((data ?? []) as SourceLeague[]);
    };

    loadSources();
  }, [sessionChecked]);

  // 3) Charger les grilles privées de la ligue choisie
  useEffect(() => {
    if (!sourceLeagueId) {
      setGrids([]);
      setSelectedGridIds(new Set());
      return;
    }

    const loadGrids = async () => {
      const leagueIdInt = parseInt(sourceLeagueId, 10);
      if (Number.isNaN(leagueIdInt)) {
        setGrids([]);
        setSelectedGridIds(new Set());
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_private_template_grids_for_league",
        { p_league_id: leagueIdInt }
      );

      if (error) {
        console.error("Erreur get_private_template_grids_for_league :", error);
        setGrids([]);
        setSelectedGridIds(new Set());
        return;
      }

      const arr = (data ?? []) as GridOption[];
      setGrids(arr);

      // par défaut : tout sélectionner
      setSelectedGridIds(new Set(arr.map((g) => g.grid_id)));
    };

    loadGrids();
  }, [sourceLeagueId]);

  if (!sessionChecked) return null;

  // Helpers sélection de grilles
  const toggleGrid = (gridId: string) => {
    setSelectedGridIds((prev) => {
      const next = new Set(prev);
      if (next.has(gridId)) {
        next.delete(gridId);
      } else {
        next.add(gridId);
      }
      return next;
    });
  };

  const toggleSelectAllGrids = () => {
    setSelectedGridIds((prev) => {
      if (grids.length === 0) return new Set();

      if (prev.size === grids.length) {
        // tout était coché → on vide
        return new Set();
      }
      // sinon on coche tout
      return new Set(grids.map((g) => g.grid_id));
    });
  };

  const allGridsSelected =
    grids.length > 0 && selectedGridIds.size === grids.length;

  // Helpers sélection de bonus
  const toggleBonus = (code: string) => {
    setSelectedBonusCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const nbSelectedBonus = selectedBonusCodes.size;

  // Soumission : ouvrir le pop-up de confirmation
  function handleOpenConfirm(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setJoinCode(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("Merci de donner un nom à ta compét privée.");
      return;
    }
    if (trimmedName.length > 20) {
      setMessage("Le nom est trop long (20 caractères max).");
      return;
    }
    if (!sourceLeagueId) {
      setMessage("Merci de choisir une ligue de départ.");
      return;
    }
    if (selectedGridIds.size === 0) {
      setMessage("Merci de sélectionner au moins une grille.");
      return;
    }

    setConfirmOpen(true);
  }

  // Validation finale après confirmation
  async function handleConfirmCreate() {
    setConfirmOpen(false);
    setCreating(true);
    setMessage(null);
    setJoinCode(null);

    try {
      const trimmedName = name.trim();
      const gridIdsArray = Array.from(selectedGridIds);

      const { data, error } = await supabase.rpc(
        "create_private_competition",
        {
          p_name: trimmedName,
          p_mode: "CLASSIC",
          p_grid_ids: gridIdsArray,
          p_bonus_codes: Array.from(selectedBonusCodes),
        }
      );

      if (error) throw error;

      const row = data && (data as any[])[0];
      if (!row) throw new Error("Réponse inattendue du serveur.");

      // 👉 on considère que tout est bon : on bascule en mode "succès"
      setCreatedInfo({
        id: row.out_competition_id,
        code: row.out_competition_join_code,
      });

      // on peut vider quelques champs si tu veux
      setName("");

      // petit scroll vers le bas pour voir le bloc de succès
      try {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      } catch {}
    } catch (err: any) {
      console.error("Erreur création compet privée :", err);
      setMessage("Impossible de créer la compétition (erreur serveur).");
    } finally {
      setCreating(false);
    }
  }

  // 👉 Si la compétition est créée, on affiche uniquement l'écran de succès
  if (createdInfo) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold mb-2">Créer une compétition privée</h1>

        <div className="border rounded-md p-4 space-y-3">
          <p className="font-semibold text-green-700">
            Compétition créée avec succès 🎉
          </p>
          <p className="text-sm">Code de ta compétition :</p>
          <p className="font-mono text-lg">{createdInfo.code}</p>
          <p className="text-xs text-gray-500">
            Garde-le bien, tu pourras aussi le retrouver plus tard dans
            l&apos;onglet &quot;Infos&quot; de la compétition.
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-2 rounded-md bg-blue-600 text-white text-sm font-semibold px-3 py-2"
          >
            Retourner à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  // 👉 Sinon, on affiche le formulaire normal
  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold mb-2">Créer une compétition privée</h1>

      <form onSubmit={handleOpenConfirm} className="space-y-4">
        {/* NOM DE LA COMPÉT */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nom de la compétition
          </label>
          <input
            type="text"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Pronos entre potes..."
          />
          <p className="mt-1 text-xs text-gray-500">20 caractères max.</p>
        </div>

        {/* LIGUE DE DÉPART */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Ligue de départ
          </label>
          <select
            value={sourceLeagueId}
            onChange={(e) => setSourceLeagueId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">Choisis une ligue</option>
            {sources.map((s) => (
              <option key={s.league_id} value={String(s.league_id)}>
                {s.league_name ?? `Ligue ${s.league_id}`} ({s.grids_count}{" "}
                grilles dispo)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Seules les ligues ayant des grilles privées non terminées sont
            listées.
          </p>
        </div>

        {/* LISTE DES GRILLES */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Grilles à inclure
          </label>

          {grids.length === 0 && (
            <p className="text-xs text-gray-500">
              Choisis d&apos;abord une ligue pour voir les grilles disponibles.
            </p>
          )}

          {grids.length > 0 && (
            <div className="border rounded p-2 max-h-64 overflow-y-auto text-sm space-y-1">
              <div className="flex items-center mb-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allGridsSelected}
                    onChange={toggleSelectAllGrids}
                  />
                  <span className="font-semibold">Tout sélectionner</span>
                </label>
              </div>

              {grids.map((g) => {
                const checked = selectedGridIds.has(g.grid_id);
                const dateLabel = g.first_match_at
                  ? new Date(g.first_match_at).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })
                  : "";

                return (
                  <label
                    key={g.grid_id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGrid(g.grid_id)}
                    />
                    <span>
                      {g.title ?? "(sans titre)"}
                      {dateLabel && ` – ${dateLabel}`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* LISTE DES BONUS */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Bonus utilisés dans la compétition
          </label>
          <div className="border rounded p-2 text-sm space-y-1">
            {ALL_BONUSES.map((b) => (
              <label
                key={b.code}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedBonusCodes.has(b.code)}
                  onChange={() => toggleBonus(b.code)}
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {nbSelectedBonus} bonus sélectionné(s).
          </p>
        </div>

        {/* BOUTONS */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-blue-600 text-white text-sm font-semibold px-3 py-1 disabled:opacity-50"
          >
            {creating ? "Création..." : "Valider"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md border border-gray-400 text-sm px-3 py-1"
          >
            Retourner à l&apos;accueil
          </button>
        </div>
      </form>

      {/* MESSAGE */}
      {message && <p className="text-sm mt-2">{message}</p>}

      {/* (joinCode ne sert plus vraiment, mais on peut le garder au cas où) */}
      {joinCode && (
        <div className="mt-2 text-sm">
          Code de ta compétition :{" "}
          <span className="font-mono font-bold">{joinCode}</span>
          <br />
          <span className="text-xs text-gray-500">
            Garde-le bien, tu pourras aussi le retrouver dans l&apos;onglet
            &quot;Infos&quot; de la compétition.
          </span>
        </div>
      )}

      {/* POP-UP DE CONFIRMATION */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-4 max-w-sm w-full space-y-3">
            <h2 className="text-lg font-semibold">Confirmer la création ?</h2>
            <p className="text-sm">
              <strong>Nom :</strong> {name.trim() || "(sans nom)"}
              <br />
              <strong>Grilles sélectionnées :</strong> {selectedGridIds.size}
              <br />
              <strong>Bonus utilisés :</strong> {nbSelectedBonus}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-400 text-sm px-3 py-1"
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-md bg-green-600 text-white text-sm px-3 py-1"
                onClick={handleConfirmCreate}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
