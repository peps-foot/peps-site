"use client";

type CompetitionInfoPanelProps = {
  name: string;
  mode: string | null;
  kind: string | null;
  joinCode: string | null;
  isCreator: boolean;
};

export default function CompetitionInfoPanel({
  name,
  mode,
  kind,
  joinCode,
  isCreator,
}: CompetitionInfoPanelProps) {
  return (
    <div className="rounded-md border p-4 space-y-2 bg-white">
      <h2 className="text-lg font-semibold">Infos compétition</h2>

      <p className="text-sm">
        <span className="font-semibold">Nom :</span> {name}
      </p>

      <p className="text-sm">
        <span className="font-semibold">Type :</span>{" "}
        {kind === "PRIVATE" ? "Compétition privée" : "Compétition publique"}{" "}
        – Mode {mode ?? "CLASSIC"}
      </p>

      <p className="text-sm">
        <span className="font-semibold">Créateur :</span>{" "}
        {isCreator ? "toi 😉" : "un autre joueur"}
        {/* plus tard on mettra le vrai pseudo */}
      </p>

      {kind === "PRIVATE" && joinCode && (
        <p className="text-sm">
          <span className="font-semibold">Code d’invitation :</span>{" "}
          <span className="font-mono font-bold">{joinCode}</span>
          <br />
          <span className="text-xs text-gray-500">
            Donne ce code à tes potes pour qu&apos;ils rejoignent ta compét.
          </span>
        </p>
      )}
    </div>
  );
}
