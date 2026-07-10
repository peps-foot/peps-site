"use client";

import type { Competition } from "../lib/types";

type Props = {
  comp: Competition | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

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
      text: "Défends les couleurs de ton club et aide ta communauté à remporter la guerre des clubs.",
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
    text: "Pronostique les résultats, utilise tes bonus au bon moment et grimpe au classement.",
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

  const startDate = formatDate(comp.displayStartDate);
  const endDate =
    comp.mode === "TOURNOI"
      ? "Selon joueurs"
      : formatDate(comp.displayEndDate);

  const unitsLabel = comp.game_type === "TIERCE" ? "Tickets" : "Grilles";
  const unitsIcon = comp.game_type === "TIERCE" ? "🎟️" : "🎯";
  
  const theme =
    comp.game_type === "TIERCE"
      ? {
          light: "bg-orange-100 border-orange-100",
          button: "bg-orange-600 hover:bg-orange-700",
        }
      : comp.game_type === "SUPPORTER"
      ? {
          light: "bg-green-100 border-green-100",
          button: "bg-green-600 hover:bg-green-700",
        }
      : {
          light: "bg-blue-100 border-blue-100",
          button: "bg-blue-600 hover:bg-blue-700",
        };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div
          className={`px-5 py-5 border-b ${theme.light}`}
        >
          <h2 className="text-center text-2xl font-extrabold text-gray-800">
            {info.title}
          </h2>

          <p className="mt-2 text-center text-sm font-semibold text-gray-600">
            {comp.name}
          </p>
        </div>

        <div className="p-5">
          <p className="text-center text-sm leading-relaxed text-gray-800">
            {info.text}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {startDate && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
                <div className="text-2xl">📅</div>
                <div className="mt-1 text-sm font-semibold ${theme.text}">
                  Début
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {startDate}
                </div>
              </div>
            )}

            {endDate && (
              <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
                <div className="text-2xl">🏁</div>
                <div className="mt-1 text-sm font-semibold ${theme.text}">
                  Fin
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {endDate}
                </div>
              </div>
            )}

            {comp.game_type !== "SUPPORTER" && comp.displayUnitsCount ? (
              <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm">
                <div className="text-2xl">{unitsIcon}</div>
                <div className="mt-1 text-sm font-semibold ${theme.text}">
                  {unitsLabel}
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {comp.displayUnitsCount}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-60"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-md transition-colors disabled:opacity-60 ${theme.button}`}
            >
              {loading ? "..." : "Rejoindre"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}