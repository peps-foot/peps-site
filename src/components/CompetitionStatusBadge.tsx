// components/CompetitionStatusBadge.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import supabase from "../lib/supabaseBrowser";
import { fetchCompetitionStatus, CompetitionMode } from "../lib/competitionStatus";

type Props = { competitionId: string; mode: CompetitionMode };
type Label = "JOUER" | "QUALIFIÉ" | "VOIR" | "A VENIR" | "Non classé" | string;

export default function CompetitionStatusBadge({ competitionId, mode }: Props) {
  const [label, setLabel] = useState<Label | null>(null);
  const [color, setColor] = useState<"blue" | "green" | "gray">("gray");

  useEffect(() => {
    let stop = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!stop) setLabel("JOUER"); return; }
      const st = await fetchCompetitionStatus({ competitionId, mode, userId: user!.id });
      if (!stop) { setLabel(st.label); setColor(st.color); }
    })();
    return () => { stop = true; };
  }, [competitionId, mode]);

const className = useMemo(() => {
  // badge compact, largeur auto, anti-wrap
const box =
  "inline-flex items-center justify-center rounded border font-medium " +
  "text-sm px-1.5 py-0.5 whitespace-nowrap flex-none";

  if (label === null)
    return `${box} border-gray-300 bg-gray-100 text-transparent`;
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
