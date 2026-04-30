"use client";

import type { Competition } from "../lib/types";

type Props = {
  comp: Competition | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

function getCompetitionText(comp: Competition) {
  const name = comp.name.toUpperCase();

    if (comp.game_type === "TIERCE") {
        return {
        title: "🚀 Mode TIERCÉ",
        text: "Choisis 3 équipes sur chaque ticket. Plus elles performent, plus tu marques de points.",
        };
    }

    if (comp.game_type === "SUPPORTER") {
        return {
        title: "❤️ Mode SUPPORTER",
        text: "Joue avec ton équipe favorite et suis-la tout au long de la saison.",
        };
    }

    if (comp.mode === "TOURNOI" && name.includes("KOH")) {
    return {
        title: "🔥 Mode 1N2 - KOH LANTA",
        text: "Pronostique les matchs. À chaque grille, les moins bons sont éliminés.",
    };
    }

    if (comp.mode === "TOURNOI" && name.includes("TERMINATOR")) {
    return {
        title: "🤖 Mode 1N2 - TERMINATOR",
        text: "Pronostique les matchs. Si tu fais moins bien que l’IA, tu es éliminé.",
    };
    }

    if (comp.mode === "TOURNOI" && name.includes("SHARK")) {
    return {
        title: "🦈 Mode 1N2 - SHARK GAME",
        text: "Pronostique les matchs. À chaque grille, la moitié des joueurs est éliminée.",
    };
    }

  return {
    title: "✖️ Mode 1N2",
    text: "Pronostique victoire, nul ou défaite sur chaque match. Ajoute tes bonus pour faire la différence.",
  };
}

export default function JoinCompetitionModal({
  comp,
  onClose,
  onConfirm,
  loading = false,
}: Props) {
  if (!comp) return null;

  const info = getCompetitionText(comp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-center text-lg font-bold">{info.title}</h2>

        <p className="mt-2 text-center text-sm font-semibold">
          {comp.name}
        </p>

        <p className="mt-3 text-center text-sm text-gray-600">
          {info.text}
        </p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {loading ? "..." : "Rejoindre"}
          </button>
        </div>
      </div>
    </div>
  );
}