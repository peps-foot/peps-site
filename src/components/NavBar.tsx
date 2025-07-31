'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

type MenuItem = {
  label: string;
  href: string;
};

export function NavBar() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showRightMenu, setShowRightMenu] = useState(false);
  const leftMenuRef = useRef<HTMLDivElement>(null);
  const rightMenuRef = useRef<HTMLDivElement>(null);

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

  const leftMenu: MenuItem[] = [
    { label: 'ACCUEIL', href: '/' },
    { label: 'COMPET 1', href: '/compet-1' },
    { label: 'COMPET 2', href: '/compet-2' },
    { label: 'COMPET 3', href: '/compet-3' },
  ];

  const rightMenu: MenuItem[] = [
    { label: 'PROFIL', href: '/profil' },
    { label: 'RÈGLES', href: '/regles' },
    { label: 'PEPS+', href: '/peps-plus' },
  ];

  if (!isClient) return null;

  const allItems = [...leftMenu, ...rightMenu];
  const currentItem = allItems.find(item => pathname.startsWith(item.href));
  const currentLabel = currentItem?.label || '';

  return (
    <nav className="relative flex items-center justify-between h-12 w-full bg-orange-500 text-white px-4 z-50">
      {/* Burger gauche */}
      <div className="relative" ref={leftMenuRef}>
        <button onClick={() => setShowLeftMenu(!showLeftMenu)} className="text-xl">
          ☰
        </button>
        {showLeftMenu && (
          <div className="absolute left-0 top-12 bg-white text-black rounded shadow min-w-max z-10">
            {leftMenu.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setShowLeftMenu(false)}
                className="block px-6 py-2 hover:bg-gray-100 flex items-center justify-between gap-2 whitespace-nowrap"
              >
                {item.label}
                <span className="text-sm text-gray-400">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nom de la page active */}
      <div className="font-semibold text-sm truncate">{currentLabel}</div>

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
