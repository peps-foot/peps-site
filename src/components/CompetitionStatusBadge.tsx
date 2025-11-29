// components/CompetitionStatusBadge.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import supabase from "../lib/supabaseBrowser";
import { fetchCompetitionStatus, CompetitionMode } from "../lib/competitionStatus";

type Props = { competitionId: string; mode: CompetitionMode };
type Label = "JOUER" | "QUALIFIÉ" | "ÉLIMINÉ" | "VOIR" | "A VENIR" | "Non classé" | string;

export default function CompetitionStatusBadge({ competitionId, mode }: Props) {
  const [label, setLabel] = useState<Label | null>(null);
  const [color, setColor] = useState<"blue" | "green" | "gray">("gray");

// Que mettre dans le badge ?
useEffect(() => {
  let stop = false;

  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (!stop) {
        setLabel("JOUER");
        setColor("blue");
      }
      return;
    }

    // 1) Vérifier l'éligibilité dans grid_player_eligibility
    const { data: eligibility, error } = await supabase
      .from("grid_player_eligibility")
      .select("can_play")
      .eq("competition_id", competitionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!stop && eligibility && eligibility.can_play === false) {
      // Joueur éliminé : on force le badge "ÉLIMINÉ"
      setLabel("ÉLIMINÉ");
      setColor("gray"); // la couleur ne servira pas vraiment, mais on met quelque chose
      return;           // très important : on ne va pas chercher le reste du statut
    }

    // 2) Sinon, on continue comme avant
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
}, [competitionId, mode]);

// pour la taille du badge et la gestion des couleurs
const className = useMemo(() => {
  const box =
    "inline-flex items-center justify-center rounded border font-medium " +
    "text-sm px-1.5 py-0.5 whitespace-nowrap flex-none min-w-[78px]";

  if (label === null)
    return `${box} border-gray-300 bg-gray-100 text-transparent`;

  // priorité au cas ÉLIMINÉ
  if (label === "ÉLIMINÉ")
    return `${box} border-red-700 text-red-800 bg-red-50`;

  if (color === "green")
    return `${box} border-green-700 text-green-800 bg-green-50`;

  if (color === "blue")
    return `${box} border-blue-700 text-blue-800 bg-blue-50`;

  return `${box} border-gray-500 text-gray-700 bg-gray-100`;
}, [label, color]);

    if (label === null) {
        return (
            <div className="w-32 h-9 inline-flex items-center justify-center rounded border border-gray-300 bg-gray-100 animate-pulse" />
        );
        }
        
 return <div className={className}>{label}</div>;
}
