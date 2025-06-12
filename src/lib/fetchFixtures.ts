// src/lib/fetchFixtures.ts
export type Fixture = {
    fixture: { id: number; date: string; };
    teams: { home: { name: string }; away: { name: string } };
    goals: { home: number; away: number };
  };
  
  export async function fetchFixtures(round: string): Promise<Fixture[]> {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?league=61&season=2022&round=${encodeURIComponent(round)}`,
      {
        headers: {
          'x-apisports-key': process.env.NEXT_PUBLIC_API_FOOTBALL_KEY!
        },
      }
    );
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    const body = await res.json();
    return body.response;
  }
  