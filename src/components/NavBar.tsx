'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import supabase from '../lib/supabaseBrowser';
import Image from "next/image";
import { groupCompetitionsForHome } from "../lib/competitionStatus"; // le module logique unique

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
};
type ColoredItem = CompetitionFull & { color: "blue" | "green" | "gray" };


export function NavBar() {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw ?? ''; // ✅ jamais null
  const [isClient, setIsClient] = useState(false);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showRightMenu, setShowRightMenu] = useState(false);
  const leftMenuRef = useRef<HTMLDivElement>(null);
  const rightMenuRef = useRef<HTMLDivElement>(null);
  const [leftMenuColored, setLeftMenuColored] = useState<ColoredItem[]>([]);

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

  // Remplir le burger menu de gauche
  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("id, name, icon, mode")
        .order("name", { ascending: true });
      if (error) { console.error("Erreur compétitions :", error); return; }
      const comps = (data ?? []) as CompetitionFull[];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLeftMenuColored(comps.map(c => ({ ...c, color: "gray" }))); return; }

      const slim = comps.map(c => ({ id: c.id, mode: c.mode }));
      const res = await groupCompetitionsForHome(slim, user.id);
      const colorMap = res.statuses; // Map(id => {label, color})

      const enriched: ColoredItem[] = comps.map(c => ({
        ...c,
        color: colorMap.get(c.id)?.color ?? "gray",
      }));

      const order = { blue: 0, green: 1, gray: 2 } as const;
      enriched.sort((a, b) => {
        const oa = order[a.color], ob = order[b.color];
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });

      setLeftMenuColored(enriched);
    };
    run();
  }, []);

  // Remplir le burger menu de droite
  const rightMenu: MenuItem[] = [
    { label: 'PROFIL', href: '/profil' },
    { label: 'RÈGLES', href: '/regles' },
    { label: 'PEPS+', href: '/peps-plus' },
    //{ label: 'PARTENAIRES', href: '/partenaires' },
  ];

  if (!isClient) return null;

  // Liste “simple” pour le calcul du titre au centre
  const leftMenuSimple = [
    { label: "ACCUEIL", href: "/" },
    ...leftMenuColored.map(c => ({ label: c.name, href: `/${c.id}` })),
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
        <button onClick={() => setShowLeftMenu((v) => !v)} className="text-xl">
          ☰
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

            {(["blue","green","gray"] as const).map((col, idx) => {
              const items = leftMenuColored.filter(c => c.color === col);
              if (items.length === 0) return null;
              return (
                <div key={col}>
                  {idx !== 0 && <div className="h-px bg-gray-200 my-1" />}
                  {items.map((c) => (
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
                            col === "blue" ? "bg-blue-600" : col === "green" ? "bg-green-600" : "bg-gray-400"
                          }`}
                          aria-hidden
                        />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="text-sm text-gray-400">›</span>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nom de la page active */}
      <div className="absolute inset-x-0 top-0 h-12 pointer-events-none flex items-center justify-center">
        <div className="font-semibold text-sm truncate pointer-events-auto">{currentLabel}</div>
      </div>

      {/* Burger droit */}
      <div className="relative" ref={rightMenuRef}>
        <button onClick={() => setShowRightMenu(!showRightMenu)} className="text-xl">
          ☰
        </button>
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