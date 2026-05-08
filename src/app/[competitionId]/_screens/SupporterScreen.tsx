'use client';

import { useEffect, useState } from 'react';
import supabase from '../../../lib/supabaseBrowser';
import Image from 'next/image';

type SupporterMatch = {
  match_id: string;
  fixture_id: number | null;
  match_date: string;

  team_home_id: number | null;
  team_away_id: number | null;

  home_team: string | null;
  away_team: string | null;

  home_logo: string | null;
  away_logo: string | null;

  score_home: number | null;
  score_away: number | null;

  status: string | null;
  league_id: number | null;
};

type SupporterScreenProps = {
  competitionId: string;
  isPrivate: boolean;
};

type SupporterView =
  | 'pronostics'
  | 'points'
  | 'rankGeneral'
  | 'rankMonth'
  | 'rules'
  | 'info';

export default function SupporterScreen({
  competitionId,
  isPrivate,
}: SupporterScreenProps) {
  const [matches, setMatches] = useState<SupporterMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<SupporterView>('pronostics');

  // Pour charger les matchs de la compétition
  useEffect(() => {
    if (!competitionId) return;

    async function loadMatches() {
      const { data, error } = await supabase.rpc('get_supporter_matches', {
        p_competition_id: competitionId,
      });

      if (error) {
        console.error('Erreur get_supporter_matches:', error);
        setMatches([]);
      } else {
        setMatches(data || []);
      }

      setLoading(false);
    }

    loadMatches();
  }, []);

  // Pour gérer le carroussel des mois
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0);

  const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  const months = Array.from(
    new Map(
        matches.map((match) => {
        const d = new Date(match.match_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        return [
            key,
            {
            key,
            title: monthFormatter.format(d),
            matches: matches.filter((m) => {
                const dm = new Date(m.match_date);
                const mKey = `${dm.getFullYear()}-${String(dm.getMonth() + 1).padStart(2, '0')}`;
                return mKey === key;
            }),
            },
        ];
        })
    ).values()
  );

  const currentMonth = months[currentMonthIdx];

  function prevMonth() {
    setCurrentMonthIdx((idx) => Math.max(0, idx - 1));
  }

  function nextMonth() {
    setCurrentMonthIdx((idx) => Math.min(months.length - 1, idx + 1));
  }



  if (loading) {
    return <div className="p-6 text-white">Chargement des matchs…</div>;
  }

  return (
    <main className="p-4">

        {/* ── Carroussel pour les mois ── */}
        <div className="border border-white/20 rounded-lg p-4 flex items-center justify-center gap-4 mb-4">
        <button
            onClick={prevMonth}
            disabled={months.length === 0 || currentMonthIdx === 0}
            className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mois précédent"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </button>

        <span className="text-2xl font-semibold text-center capitalize">
            {currentMonth?.title || 'Chargement...'}
        </span>

        <button
            onClick={nextMonth}
            disabled={months.length === 0 || currentMonthIdx === months.length - 1}
            className="bg-[#212121] hover:bg-gray-800 text-white rounded-full p-2 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mois suivant"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
        </button>
        </div>

        {/* ── Zone info avec les pastilles qui mènent aux vues ── */}
        <div className="border border-white/20 rounded-lg p-4 flex items-center justify-center gap-4 mb-4">
        {/* 1) Pronostics */}
        <button
            onClick={() => setView('pronostics')}
            aria-pressed={view === 'pronostics'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'pronostics' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Faire mes pronos"
        >
            <Image
            src="/images/icons/grille.png"
            alt="Pronos"
            width={40}
            height={40}
            className="rounded-full object-cover"
            />
        </button>

        {/* 2) Points */}
        <button
            onClick={() => setView('points')}
            aria-pressed={view === 'points'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'points' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Mes points"
        >
            <div className="w-full h-full rounded-full flex items-center justify-center text-black font-bold">
            pts
            </div>
        </button>

        {/* 3) Classement général */}
        <button
            onClick={() => setView('rankGeneral')}
            aria-pressed={view === 'rankGeneral'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rankGeneral' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Classement général"
        >
            <Image
            src="/images/icons/podium.png"
            alt="Général"
            width={40}
            height={40}
            className="rounded-full object-cover"
            />
        </button>

        {/* 4) Classement du mois */}
        <button
            onClick={() => setView('rankMonth')}
            aria-pressed={view === 'rankMonth'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rankMonth' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Classement du mois"
        >
            <Image
            src="/images/icons/classement.png"
            alt="Mois"
            width={40}
            height={40}
            className="rounded-full object-cover"
            />
        </button>

        {/* 5) Infos compétition privée */}
        {isPrivate && (
            <button
            onClick={() => setView('info')}
            aria-pressed={view === 'info'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'info' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Infos de la compétition"
            >
            <Image
                src="/images/icons/info.png"
                alt="Infos"
                width={40}
                height={40}
                className="rounded-full object-cover"
            />
            </button>
        )}

        {/* 6) Règles */}
        <button
            onClick={() => setView('rules')}
            aria-pressed={view === 'rules'}
            className={`w-12 h-12 rounded-full border border-black bg-white p-[3px]
                        flex items-center justify-center transition hover:bg-neutral-50 focus:outline-none
                        ${view === 'rules' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
            title="Règles"
        >
            <Image
            src="/images/icons/regles.png"
            alt="Règles"
            width={40}
            height={40}
            className="rounded-full object-cover"
            />
        </button>
        </div>

        {/* ── Vue PRONOSTICS : zone matchs + zone bonus ── */}
        {view === 'pronostics' && (
        <div className="flex flex-col lg:flex-row gap-6">
            
            {/* ── Colonne gauche : matchs du mois, 2/3 sur grand écran ── */}
            <div className="w-full lg:w-2/3">
            <div className="border rounded-lg">
                <button
                type="button"
                className="w-full flex items-center px-4 py-3"
                >
                <span className="font-semibold text-center flex-1">
                    🎯 Fais tes pronos
                </span>
                </button>

                <div className="px-4 pb-4 space-y-2">
                <div className="space-y-3">
                    {currentMonth?.matches.map((match) => {
                    const status = String(match.status ?? '').toUpperCase();
                    const isLocked = status !== 'NS';

                    return (
                        <div
                        key={match.match_id}
                        className="border rounded-lg p-3 bg-white"
                        >
                        {/* ── Ligne 1 : date + statut ── */}
                        <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>
                            {new Date(match.match_date).toLocaleDateString('fr-FR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                            </span>

                            <span>
                            {isLocked ? '🔒 Verrouillé' : '🟢 À jouer'}
                            </span>
                        </div>

                        {/* ── Ligne 2 : équipes ── */}
                        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            <div className="text-right font-semibold">
                            {match.home_team}
                            </div>

                            <div className="px-3 py-1 rounded-lg bg-gray-100 font-bold">
                            {status === 'NS'
                                ? '-'
                                : `${match.score_home ?? '-'} - ${match.score_away ?? '-'}`}
                            </div>

                            <div className="text-left font-semibold">
                            {match.away_team}
                            </div>
                        </div>

                        {/* ── Ligne 3 : saisie du score ── */}
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            className="w-16 rounded-lg bg-gray-50 border text-center text-xl font-bold py-2 disabled:opacity-50"
                            placeholder="-"
                            />

                            <span className="text-xl font-bold">-</span>

                            <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            className="w-16 rounded-lg bg-gray-50 border text-center text-xl font-bold py-2 disabled:opacity-50"
                            placeholder="-"
                            />
                        </div>
                        </div>
                    );
                    })}
                </div>
                </div>
            </div>
            </div>

            {/* ── Colonne droite : bonus, 1/3 sur grand écran et dessous sur mobile ── */}
            <div className="w-full lg:w-1/3">
            <div className="border rounded-lg">
                <button
                type="button"
                className="w-full flex items-center px-4 py-3"
                >
                <span className="font-semibold text-center flex-1">
                    🎁 Bonus SUPPORTER
                </span>
                </button>

                <div className="px-4 pb-4 space-y-3 text-sm text-gray-700">
                <div className="rounded-lg border p-3">
                    🟡 DOUBLE : x2
                </div>

                <div className="rounded-lg border p-3">
                    🔴 TRIPLE : x3
                </div>

                <div className="rounded-lg border p-3">
                    🪵 POTEAU RENTRANT
                </div>
                </div>
            </div>
            </div>
        </div>
        )}

        {/* ── Vue POINTS ── */}
        {view === 'points' && (
        <div className="border border-white/20 rounded-lg p-4 text-center">
            Mes points SUPPORTER — en construction
        </div>
        )}

        {/* ── Vue CLASSEMENT GENERAL ── */}
        {view === 'rankGeneral' && (
        <div className="border border-white/20 rounded-lg p-4 text-center">
            Classement général — en construction
        </div>
        )}

        {/* ── Vue CLASSEMENT du MOIS ── */}
        {view === 'rankMonth' && (
        <div className="border border-white/20 rounded-lg p-4 text-center">
            Classement du mois — en construction
        </div>
        )}

        {/* ── Vue REGLES ── */}
        {view === 'rules' && (
        <div className="border border-white/20 rounded-lg p-4 text-center">
            Règles SUPPORTER — en construction
        </div>
        )}

        {/* ── Vue INFO si mode PRIVATE ── */}
        {view === 'info' && (
        <div className="border border-white/20 rounded-lg p-4 text-center">
            Infos compétition — en construction
        </div>
        )}



    </main>
  );
}