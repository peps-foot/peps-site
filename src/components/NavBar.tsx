'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabase } from './SupabaseProvider';
import { useEffect, useState } from 'react';

console.log('[NavBar] rendu');

type Tab = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function NavBar() {
  const supabase = useSupabase();
  const pathname = usePathname();
  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const compName = 'PEPS TEST';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/connexion');
  };

  const tabs: Tab[] = [
    { label: compName, href: '/' },
    { label: 'CLASSEMENT', href: '/classement' },
    { label: 'RÈGLES', href: '/regles' },
    { label: 'PROFIL', href: '/profil' },
    { label: 'DÉCONNEXION', onClick: handleSignOut },
  ];

  if (!isClient) return null;

  return (
    <nav className="flex h-12">
      {tabs.map((tab) => {
        const active =
        tab.href === '/'
        ? pathname === '/' || pathname.match(/^\/[0-9a-fA-F-]{36}$/)
        : tab.href === pathname;
        const base =
          'flex-1 flex items-center justify-center font-medium text-sm h-full transition-all';
        const color = active
        ? 'bg-black text-white'
        : 'bg-orange-500 text-white';

        if (tab.href) {
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`${base} ${color}`}
            >
              {tab.label}
            </Link>
          );
        }

        return (
          <button
            key={tab.label}
            onClick={tab.onClick}
            className={`${base} ${color}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
