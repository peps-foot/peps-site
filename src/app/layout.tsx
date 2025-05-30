'use client';
import './globals.css';

import React from 'react';
import { usePathname } from 'next/navigation';   // ← on importe bien usePathname
import { NavBar } from '@/components/NavBar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // On cache la navbar sur la page de connexion/inscription et sur /admin/*
  const hideHeader = 
    pathname === '/connexion' ||
    pathname === '/inscription' ||
    pathname.startsWith('/admin');

  console.log('🏗️ layout render – children:', children);
  return (
    <html lang="fr">
      <head />
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-screen">
        {!hideHeader && <NavBar />}

        <main>{children}</main>
      </body>
    </html>
  );
}
