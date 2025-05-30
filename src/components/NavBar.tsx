'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Tab = {
  label: string;
  href: string;
};

export function NavBar() {
  const pathname = usePathname();

  // 1) État pour le nom de la compèt (défaut = 'ACCUEIL')
  const [compName, setCompName] = useState<string>('ACCUEIL');

  // 2) Au montage, fetch du nom de la compèt
  useEffect(() => {
    async function loadCompetition() {
      const { data, error } = await supabase
        .from('competitions')
        .select('name')
        .order('created_at', { ascending: false }) // si plusieurs, on prend la plus récente
        .limit(1)
        .single();

      if (!error && data) {
        setCompName(data.name);
      } else {
        console.warn('Impossible de charger le nom de la compèt', error);
      }
    }
    loadCompetition();
  }, []);

  // 3) On utilise compName pour le premier onglet
  const tabs: Tab[] = [
    { label: compName,    href: '/' },
    { label: 'CLASSEMENT', href: '/classement' },
    { label: 'RÈGLES',     href: '/regles' },
    { label: 'PROFIL',     href: '/profil' },
    { label: 'DÉCONNEXION', href: '/deconnexion' },
  ];

  return (
    <nav className="flex h-12">
      {tabs.map((tab) => {
        const active = tab.href === pathname;
        const base   = 'flex-1 flex items-center justify-center font-medium';
        const style  = active
          ? 'bg-[#212121] text-white'
          : 'bg-[#FF6D00] text-[#212121] hover:bg-orange-500';

          return (
            <Link key={tab.label}
                  href={tab.href}
                  className={`${base} ${style}`}>
              {tab.label}
            </Link>
          );
      })}
    </nav>
  );
}
