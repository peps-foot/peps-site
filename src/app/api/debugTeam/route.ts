// src/app/api/debugTeam/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "33";

  const url = new URL("https://v3.football.api-sports.io/teams");
  url.searchParams.set("id", id);

  const r = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": "12a112da460820962f5e9fc0b261d2a",
    },
    cache: "no-store",
  });

  const data = await r.json();
  return NextResponse.json(data);
}
