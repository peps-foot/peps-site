import './globals.css'
import type { Metadata } from 'next'
import { Oswald, Poppins } from 'next/font/google'
import ClientLayout from '@/components/ClientLayout'

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-title',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'PEPS - Pronos entre Potes',
  description: 'Site de jeu de pronostics de football entre amis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${oswald.variable} ${poppins.variable}`}>
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
