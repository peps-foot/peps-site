import { NextResponse } from 'next/server';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export async function GET() {
  const API_KEY = process.env.API_FOOTBALL_KEY!;
  const league = 39; // Premier League (change ton ID si besoin)
  const season = 2024;

  const statuses = ['NS','1H','2H','HT','FT'].join(',');
  const url = `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}&status=${statuses}`;

  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const json = await res.json();
  console.log('📊 filter fixtures:', json.response.length);
  console.log(JSON.stringify(json.response, null, 2));

  return NextResponse.json({
    ok: true,
    total: json.response.length,
    matches: json.response
  });
}
