
console.log("💡 layout.tsx chargé");
import './globals.css';
import React from 'react';
import SupabaseProvider from '@/components/SupabaseProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head />
      <body className="font-sans antialiased bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
