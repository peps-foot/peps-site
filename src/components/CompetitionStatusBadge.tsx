"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../lib/supabaseBrowser";
import { fetchCompetitionStatus, CompetitionMode } from "../lib/competitionStatus";

type Props = {
  competitionId: string;
  mode: CompetitionMode;
  isMember?: boolean;
  allFT?: boolean;
  hasNS?: boolean;
  onClick?: () => void; // 👈 prop React, avec un C majuscule
};

type Label = "JOUER" | "QUALIFIÉ" | "ÉLIMINÉ" | "VOIR" | "A VENIR" | "Non classé" | "FINALE" |  string;

export default function CompetitionStatusBadge({
  competitionId,
  mode,
  isMember,
  allFT,
  hasNS,
  onClick, // 👈 on récupère bien la prop ici
}: Props) {
  const [label, setLabel] = useState<Label | null>(null);
  const [color, setColor] = useState<"blue" | "green" | "gray" | "yellow">("gray");

  useEffect(() => {
    let stop = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Pas connecté
      if (!user) {
        if (allFT) {
          if (!stop) {
            setLabel("VOIR");
            setColor("gray");
          }
        } else {
          if (!stop) {
            setLabel("JOUER");
            setColor("blue");
          }
        }
        return;
      }

      // Non-membre
      if (isMember === false) {
        if (allFT) {
          if (!stop) {
            setLabel("VOIR");
            setColor("gray");
          }
        } else {
          if (!stop) {
            setLabel("JOUER");
            setColor("blue");
          }
        }
        return;
      }

      // Membre → vérifier éligibilité
      const { data: eligibility } = await supabase
        .from("grid_player_eligibility")
        .select("can_play")
        .eq("competition_id", competitionId)
        .eq("user_id", user.id)
        .maybeSingle();

      // 🔹 joueur éliminé
      if (!stop && eligibility && eligibility.can_play === false) {
        setLabel("ÉLIMINÉ");
        setColor("gray");
        return;
      }

      // 🔹 cas FINALE (tournoi terminé, joueur jamais marqué éliminé)
      if (allFT && mode === "TOURNOI" && (!eligibility || eligibility.can_play === null)) {
        if (!stop) {
          setLabel("FINALE");
          setColor("yellow");
        }
        return;
      }

      // 🔹 sinon : logique existante (classement / qualifié...)
      const st = await fetchCompetitionStatus({
        competitionId,
        mode,
        userId: user.id,
      });

      if (!stop) {
        setLabel(st.label);
        setColor(st.color);
      }
    })();

    return () => {
      stop = true;
    };
  }, [competitionId, mode, isMember, allFT, hasNS]);

  // Handler click compatible avec React
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onClick) return;
      e.preventDefault();
      onClick();
    },
    [onClick]
  );

  const className = useMemo(() => {
    const box =
      "inline-flex items-center justify-center rounded border font-medium " +
      "text-sm px-1.5 py-0.5 whitespace-nowrap flex-none min-w-[78px]";

    if (label === null)
      return `${box} border-gray-300 bg-gray-100 text-transparent`;

    if (label === "ÉLIMINÉ")
      return `${box} border-red-700 text-red-800 bg-red-50`;

    if (color === "green")
      return `${box} border-green-700 text-green-800 bg-green-50`;

    if (color === "blue")
      return `${box} border-blue-700 text-blue-800 bg-blue-50`;

    if (color === "yellow")
      return `${box} border-yellow-500 text-yellow-800 bg-yellow-50`;

    return `${box} border-gray-500 text-gray-700 bg-gray-100`;
  }, [label, color]);

  if (label === null) {
    return (
      <div className="inline-flex items-center justify-center rounded border border-gray-300 bg-gray-100 animate-pulse text-sm px-1.5 py-0.5 whitespace-nowrap flex-none min-w-[78px]" />
    );
  }

  return (
    <div
      className={className + (onClick ? " cursor-pointer hover:opacity-80" : "")}
      onClick={onClick ? handleClick : undefined}
    >
      {label}
    </div>
  );
}
