"use client";

import Image from "next/image";
import { Competition } from "../lib/types";

type Props = {
  comp: Competition;
  onClick: () => void;
  formatDeadline: (d?: string | null) => string;
  getCompetitionStatusText: (c: Competition) => string;
  getDeadlineColor: (d?: string | null) => string;
};

export default function CompetitionHomeCard({
  comp,
  onClick,
  formatDeadline,
  getCompetitionStatusText,
  getDeadlineColor,
}: Props) {
  const statusText = getCompetitionStatusText(comp);

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg shadow-sm hover:shadow-md transition cursor-pointer flex overflow-hidden mb-3 ${
        comp.game_type === "TIERCE"
          ? "bg-green-50"
          : comp.game_type === "SUPPORTER"
          ? "bg-orange-50"
          : "bg-blue-50"
      }`}
    >
      {/* BANDE COULEUR */}
      <div
        className={`w-1 flex-shrink-0 ${
          comp.game_type === "TIERCE"
            ? "bg-green-400"
            : comp.game_type === "SUPPORTER"
            ? "bg-orange-400"
            : "bg-blue-400"
        }`}
      />

      {/* LOGO */}
      <div className="w-20 flex-shrink-0 flex items-center justify-center border-r border-gray-200">
        <Image
          src={`/${comp.icon ?? "images/compet/placeholder.png"}`}
          alt={comp.name}
          width={64}
          height={64}
          className="rounded-full object-cover"
        />
      </div>

      {/* CONTENU */}
      <div className="flex-1 px-3 py-2 flex flex-col gap-1">
        <div className="font-semibold text-base leading-tight">
          {comp.name}
        </div>

        <div className="grid grid-cols-2 text-sm text-gray-600">
          <span>🎮 {comp.game_type === "TIERCE" ? "TIERCE" : "1N2"}</span>
          <span>⚔️ {comp.mode}</span>
        </div>

        <div className="grid grid-cols-2 items-center text-sm">
          <span className="font-medium text-gray-800">
            🏆{" "}
            {statusText === "CLASSEMENT"
              ? comp.userRank
                ? `${comp.userRank}e / ${comp.playersCount}`
                : "—"
              : statusText}
          </span>

          <span className={getDeadlineColor(comp.nextPredictionDeadline)}>
          ⏱️ {formatDeadline(comp.nextPredictionDeadline)}
          </span>
        </div>
      </div>
    </div>
  );
}