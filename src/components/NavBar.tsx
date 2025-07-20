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

  const tabs: Tab[] = [
    { label: compName, href: '/a033d6cf-7108-4f92-8f71-1d2b428d11f2' },
    { label: 'CLASSEMENT', href: '/classement' },
    { label: 'RÈGLES', href: '/regles' },
    { label: 'PROFIL', href: '/profil' },
    { label: 'PEPS+', href: '/peps-plus' },
  ];

  if (!isClient) return null;

return (
  <nav className="flex h-12 w-full">
  {tabs.map((tab) => {
    const safePath = pathname ?? '';
    const href = tab.href ?? '';

    // Cas UUID : la homepage = /[competitionId]
    const isUUID = /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      safePath.replace('/', '')
    );

    const active =
      (href === '/' && isUUID) ||
      (href !== '/' && safePath.startsWith(href));

    const base =
      'flex-1 flex items-center justify-center font-medium text-sm h-full transition-all';
    const color = active ? 'bg-black text-white' : 'bg-orange-500 text-white';

    return (
      <Link
        key={tab.label}
        href={href}
        className={`${base} ${color}`}
      >
        {tab.label}
      </Link>
    );
  })}
</nav>
);
}
