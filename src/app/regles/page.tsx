'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function ReglesPage() {
  const [open, setOpen] = useState(false)

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">RÈGLES DU JEU</h1>

      {/* Bloc Bonus KANTE */}
      <div className="border rounded-xl overflow-hidden shadow mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-100 hover:bg-blue-200 font-semibold"
        >
          <div className="flex items-center gap-2">
            <Image
              src="/images/kante.png"
              alt="Kanté"
              width={30}
              height={30}
              className="rounded-full"
            />
            <span>Le bonus KANTÉ</span>
          </div>
          <span>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="bg-white p-4 space-y-4 text-sm">
            <p>
              <strong>Description :</strong> Quand N’golo joue dans ton équipe c’est comme si tu avais deux joueurs en un.
              Ici c’est pareil, il te permet de cocher deux croix pour un match.
              Au lotofoot, c’est comme un double : 1-N, N-2 ou 1-2.
            </p>
            <p><strong>Avantage :</strong> tu as deux chances sur trois de gagner des points.</p>
            <p><strong>Inconvénient :</strong> tu ne gagnes que la plus petite des deux cotes.</p>
            <strong>Exemple :</strong> tu ne gagnes que la plus petite des deux cotes.
            <div className="flex justify-center">
              <Image
                src="/images/exemple_kante.png"
                alt="Exemple visuel bonus Kanté"
                width={400}
                height={100}
                className="rounded-lg border"
              />
            </div>
            <p>Si Dortmund gagne ou fait match nul, tu gagnes 4 points</p>
            <p>Si Dortmund perd, tu ne gagnes pas de points.</p>
          </div>
        )}
      </div>
    </main>
  )
}