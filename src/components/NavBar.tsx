'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";

type Competition = {
  id: string;
  name: string;
};

type MenuItem = {
  label: string;
  href: string;
};

type CompetitionFull = {
  id: string;
  name: string;
  icon: string | null;
  mode: "CLASSIC" | "TOURNOI";
  game_type: "GRID" | "TIERCE" | "SUPPORTER";
  homeTab: "MINE" | "TO_JOIN" | "HISTORY" | "HIDDEN";
  created_at: string;
};
type LeftMenuItem = CompetitionFull;


export function NavBar() {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw ?? ''; // ✅ jamais null
  const [isClient, setIsClient] = useState(false);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showRightMenu, setShowRightMenu] = useState(false);
  const leftMenuRef = useRef<HTMLDivElement>(null);
  const rightMenuRef = useRef<HTMLDivElement>(null);
  const [leftMenuItems, setLeftMenuItems] = useState<LeftMenuItem[]>([]);
  const [avatar, setAvatar] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        leftMenuRef.current &&
        !leftMenuRef.current.contains(event.target as Node)
      ) {
        setShowLeftMenu(false);
      }

      if (
        rightMenuRef.current &&
        !rightMenuRef.current.contains(event.target as Node)
      ) {
        setShowRightMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // gestion de l'avatar + état connecté / non connecté
  useEffect(() => {
    const fetchAvatar = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoggedIn(false)
        setAvatar('')
        return
      }

      setIsLoggedIn(true)

      const { data } = await supabase
        .from('profiles')
        .select('avatar')
        .eq('user_id', user.id)
        .single()

      if (data?.avatar) {
        setAvatar(data.avatar)
      }
    }

    fetchAvatar()
  }, [])

  // Remplir le burger menu de gauche (uniquement les compétitions où l'utilisateur est PLAYER/CREATOR)
  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLeftMenuItems([]);
        return;
      }

      const { data, error } = await supabase.rpc("get_home_competitions", {
        p_user_id: user.id,
      });

      if (error) {
        console.error("Erreur Navbar get_home_competitions :", error);
        setLeftMenuItems([]);
        return;
      }

      const typeOrder = {
        SUPPORTER: 0,
        GRID: 1,
        TIERCE: 2,
      };

      const mine = (data ?? [])
        .filter((c: CompetitionFull) => c.homeTab === "MINE")
        .sort((a: CompetitionFull, b: CompetitionFull) => {
          const ta = typeOrder[a.game_type as keyof typeof typeOrder] ?? 99;
          const tb = typeOrder[b.game_type as keyof typeof typeOrder] ?? 99;

          if (ta !== tb) return ta - tb;

          return a.name.localeCompare(b.name);
        });

      setLeftMenuItems(mine);
    };

    run();
  }, []);

  // Remplir le burger menu de droite
  const rightMenu: MenuItem[] = [
    { label: 'PROFIL', href: '/profil' },
    { label: 'RÈGLES', href: '/regles' },
    { label: 'PEPS+', href: '/peps-plus' },
    { label: 'NOTIFS', href: '/notifications' },
    { label: 'CARRIERE', href: '/carriere' },
    //{ label: 'PARTENAIRES', href: '/partenaires' },
  ];

  if (!isClient) return null;

  // Liste “simple” pour le calcul du titre au centre
  const leftMenuSimple = [
    { label: "ACCUEIL", href: "/" },
    ...leftMenuItems.map(c => ({ label: c.name, href: `/${c.id}` })),
  ];

  const allItems = [...leftMenuSimple, ...rightMenu];
  const currentItem = [...allItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname.startsWith(item.href));
  const currentLabel = currentItem?.label ?? "";

  return (
    <nav className="relative flex items-center justify-between h-12 w-full bg-orange-500 text-white px-4 z-50">
      {/* Burger gauche */}
      <div className="relative" ref={leftMenuRef}>
        <button
          onClick={() => setShowLeftMenu((v) => !v)}
          className="w-10 h-10 rounded-full border border-black/70 shadow flex items-center justify-center overflow-hidden hover:scale-105 transition"
        >
          <Image
            src="/images/default-avatar.png"
            alt="PEPS"
            width={36}
            height={36}
            className="h-8 w-8 rounded-lg"
          />
        </button>
        {showLeftMenu && (
          <div className="absolute left-0 top-12 bg-white text-black rounded shadow min-w-max z-10 w-64">
            <Link
              href="/"
              onClick={() => setShowLeftMenu(false)}
              className="block px-4 py-2 hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <Image
                  src="/images/empty-box.png"   // logo PEPS
                  alt="Accueil"
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-black/10"
                />
                <span
                  className="h-2.5 w-2.5 rounded-full bg-orange-500"
                  aria-hidden
                />
                <span className="flex-1 truncate">ACCUEIL</span>
                <span className="text-sm text-gray-400">›</span>
              </div>
            </Link>

            <div className="h-px bg-gray-200 my-1" />

            {leftMenuItems.map((c) => (
              <Link
                key={c.id}
                href={`/${c.id}`}
                onClick={() => setShowLeftMenu(false)}
                className="block px-4 py-2 hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={`/${c.icon ?? "images/compet/placeholder.png"}`}
                    alt={c.name}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-black/10"
                  />

                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      c.game_type === "GRID"
                        ? "bg-blue-600"
                        : c.game_type === "TIERCE"
                        ? "bg-orange-600"
                        : "bg-green-500"
                    }`}
                    aria-hidden
                  />

                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-sm text-gray-400">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nom de la page active */}
      <div className="absolute inset-x-0 top-0 h-12 pointer-events-none flex items-center justify-center">
        <div className="font-semibold text-sm truncate pointer-events-auto">{currentLabel}</div>
      </div>

      {/* Burger droit */}
      <div className="relative" ref={rightMenuRef}>

        {avatar ? (
          // 👉 CAS AVATAR
          <button
            onClick={() => setShowRightMenu(!showRightMenu)}
            className="w-10 h-10 rounded-full bg-white border border-black/70 shadow flex items-center justify-center overflow-hidden hover:scale-105 transition"
          >
            <img
              src={avatar}
              alt="avatar"
              className="w-8 h-8 object-contain"
            />
          </button>
        ) : isLoggedIn ? (
          // 👉 CAS CONNECTÉ MAIS PAS D’AVATAR → burger classique
          <button
            onClick={() => setShowRightMenu(!showRightMenu)}
            className="text-xl"
          >
            ☰
          </button>
        ) : (
          // 👉 CAS NON CONNECTÉ → bouton connexion direct
          <Link
            href="/connexion"
            className="text-sm font-semibold bg-white text-orange-600 px-3 py-1.5 rounded-full"
          >
            Se connecter
          </Link>
        )}

        {showRightMenu && (
          <div className="absolute right-0 top-12 bg-white text-black rounded shadow min-w-max z-10">
            {rightMenu.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setShowRightMenu(false)}
                className="block px-6 py-2 hover:bg-gray-100 flex items-center justify-between gap-2 whitespace-nowrap"
              >
                {item.label}
                <span className="text-sm text-gray-400">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}