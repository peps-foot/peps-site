'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSupabase } from './SupabaseProvider';

type TicketRow = {
  id: string;
  title: string;
  created_at?: string;
};

type MatchRow = {
  id: string;
  date: string | null;
  home_team: string | null;
  away_team: string | null;
  attendance: number | null;
  venue_id: number | null;
  venue_name: string | null;
  capacity: number | null;
};

export default function AdminAttendancePanel() {
  const supabase = useSupabase();

  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [matches, setMatches] = useState<MatchRow[]>([]);

  const [attendanceByMatch, setAttendanceByMatch] = useState<Record<string, string>>({});
  const [ticketDoneMap, setTicketDoneMap] = useState<Record<string, boolean>>({});

  // Charger la liste des tickets
  useEffect(() => {
    (async () => {
      setLoadingTickets(true);
      setMessage(null);

      try {
        const { data: ticketRows, error: ticketErr } = await supabase
          .from('tierce_tickets')
          .select('id, title, created_at')
          .order('created_at', { ascending: false });

        if (ticketErr) throw new Error(ticketErr.message);

        const safeTickets = (ticketRows || []) as TicketRow[];
        setTickets(safeTickets);

        // Calcul simple du statut "ticket complété"
        const { data: links, error: linksErr } = await supabase
          .from('tierce_ticket_matches')
          .select('ticket_id, match_id');

        if (linksErr) throw new Error(linksErr.message);

        const allMatchIds = [...new Set((links || []).map((r: any) => r.match_id))];

        let matchAttendanceMap: Record<string, boolean> = {};
        if (allMatchIds.length > 0) {
          const { data: matchRows, error: matchErr } = await supabase
            .from('matches')
            .select('id, attendance')
            .in('id', allMatchIds);

          if (matchErr) throw new Error(matchErr.message);

          matchAttendanceMap = Object.fromEntries(
            (matchRows || []).map((m: any) => [m.id, m.attendance !== null])
          );
        }

        const grouped: Record<string, string[]> = {};
        (links || []).forEach((row: any) => {
          if (!grouped[row.ticket_id]) grouped[row.ticket_id] = [];
          grouped[row.ticket_id].push(row.match_id);
        });

        const doneMap: Record<string, boolean> = {};
        for (const ticket of safeTickets) {
          const mids = grouped[ticket.id] || [];
          doneMap[ticket.id] =
            mids.length > 0 && mids.every((mid) => matchAttendanceMap[mid] === true);
        }

        setTicketDoneMap(doneMap);
      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement tickets'));
      } finally {
        setLoadingTickets(false);
      }
    })();
  }, [supabase]);

  // Charger les matchs du ticket sélectionné
  useEffect(() => {
    if (!selectedTicketId) {
      setMatches([]);
      setAttendanceByMatch({});
      return;
    }

    (async () => {
      setLoadingMatches(true);
      setMessage(null);

      try {
        const { data: links, error: linksErr } = await supabase
          .from('tierce_ticket_matches')
          .select('match_id')
          .eq('ticket_id', selectedTicketId);

        if (linksErr) throw new Error(linksErr.message);

        const matchIds = (links || []).map((r: any) => r.match_id);
        if (matchIds.length === 0) {
          setMatches([]);
          setAttendanceByMatch({});
          return;
        }

        const { data: matchRows, error: matchErr } = await supabase
          .from('matches')
          .select('id, date, home_team, away_team, attendance, venue_id')
          .in('id', matchIds);

        if (matchErr) throw new Error(matchErr.message);

        const venueIds = [...new Set((matchRows || []).map((m: any) => m.venue_id).filter(Boolean))];

        let venuesMap: Record<number, { name: string | null; capacity: number | null }> = {};
        if (venueIds.length > 0) {
          const { data: venueRows, error: venueErr } = await supabase
            .from('venues')
            .select('id, name, capacity')
            .in('id', venueIds);

          if (venueErr) throw new Error(venueErr.message);

          venuesMap = Object.fromEntries(
            (venueRows || []).map((v: any) => [
              v.id,
              { name: v.name ?? null, capacity: v.capacity ?? null },
            ])
          );
        }

        const merged: MatchRow[] = (matchRows || [])
          .map((m: any) => ({
            id: m.id,
            date: m.date,
            home_team: m.home_team,
            away_team: m.away_team,
            attendance: m.attendance,
            venue_id: m.venue_id,
            venue_name: m.venue_id ? venuesMap[m.venue_id]?.name ?? null : null,
            capacity: m.venue_id ? venuesMap[m.venue_id]?.capacity ?? null : null,
          }))
          .sort((a, b) => {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db = b.date ? new Date(b.date).getTime() : 0;
            return da - db;
          });

        setMatches(merged);

        const attendanceMap: Record<string, string> = {};
        merged.forEach((m) => {
          attendanceMap[m.id] = m.attendance !== null ? String(m.attendance) : '';
        });
        setAttendanceByMatch(attendanceMap);
      } catch (e: any) {
        setMessage('❌ ' + (e?.message || 'Erreur chargement matchs'));
      } finally {
        setLoadingMatches(false);
      }
    })();
  }, [supabase, selectedTicketId]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const saveAttendance = async (match: MatchRow) => {
    setMessage(null);

    const raw = attendanceByMatch[match.id]?.trim() ?? '';
    if (!raw) {
      setMessage('❌ Renseigne une affluence.');
      return;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setMessage('❌ L’affluence doit être un nombre valide.');
      return;
    }

    if (match.capacity !== null && value > match.capacity) {
      setMessage(`❌ Affluence impossible : ${value} dépasse la capacité (${match.capacity}).`);
      return;
    }

    setSavingMatchId(match.id);
    try {
      const { error: updErr } = await supabase
        .from('matches')
        .update({ attendance: value })
        .eq('id', match.id);

      if (updErr) throw new Error(updErr.message);

      const { error: rpcErr } = await supabase.rpc('update_tierce_points_for_match', {
        p_match_id: match.id,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      setMatches((prev) =>
        prev.map((m) => (m.id === match.id ? { ...m, attendance: value } : m))
      );

      // recalcul statut du ticket
      setTicketDoneMap((prev) => {
        const allDone = matches
          .map((m) => (m.id === match.id ? { ...m, attendance: value } : m))
          .every((m) => m.attendance !== null);
        return selectedTicketId ? { ...prev, [selectedTicketId]: allDone } : prev;
      });

      setMessage('✅ Affluence enregistrée et points TIERCE mis à jour.');
    } catch (e: any) {
      setMessage('❌ ' + (e?.message || 'Erreur sauvegarde'));
    } finally {
      setSavingMatchId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Affluences</h2>

      {message && (
        <div
          className={`p-3 rounded ${
            message.startsWith('✅')
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block mb-1 font-medium">Ticket TIERCE</label>
          <select
            value={selectedTicketId}
            onChange={(e) => setSelectedTicketId(e.target.value)}
            className="w-full border rounded p-2"
            disabled={loadingTickets}
          >
            <option value="">— Choisir —</option>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {ticketDoneMap[t.id] ? '✅ ' : '🕒 '}
                {t.title}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            🕒 = affluences incomplètes / ✅ = ticket entièrement renseigné
          </div>
        </div>
      </div>

      <div className="border rounded">
        <div className="p-3 border-b font-medium">
          {selectedTicket ? `Matchs du ticket : ${selectedTicket.title}` : 'Matchs du ticket'}
        </div>

        {!selectedTicketId ? (
          <div className="p-3 text-gray-600">Choisis un ticket.</div>
        ) : loadingMatches ? (
          <div className="p-3 text-gray-600">Chargement…</div>
        ) : matches.length === 0 ? (
          <div className="p-3 text-gray-600">Aucun match trouvé pour ce ticket.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2"></th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Match</th>
                  <th className="text-left p-2">Stade / Capacité</th>
                  <th className="text-left p-2">Affluence</th>
                  <th className="text-left p-2"></th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">{m.attendance !== null ? '✅' : ''}</td>

                    <td className="p-2">
                      {m.date
                        ? new Date(m.date).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>

                    <td className="p-2">
                      {m.home_team} vs {m.away_team}
                    </td>

                    <td className="p-2">
                      <div>{m.venue_name ?? 'Stade inconnu'}</div>
                      <div className="text-xs text-gray-500">
                        {m.capacity !== null ? `Capacité : ${m.capacity}` : 'Capacité inconnue'}
                      </div>
                    </td>

                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        value={attendanceByMatch[m.id] ?? ''}
                        onChange={(e) =>
                          setAttendanceByMatch((prev) => ({
                            ...prev,
                            [m.id]: e.target.value,
                          }))
                        }
                        className="w-32 border rounded p-1"
                        placeholder="Affluence"
                      />
                    </td>

                    <td className="p-2">
                      <button
                        onClick={() => saveAttendance(m)}
                        disabled={savingMatchId === m.id}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {savingMatchId === m.id ? '...' : 'Valider'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}