'use client'

import Image from 'next/image'

export default function ReglesPage() {
  return (
    <div className="min-h-screen bg-white">

      <main className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <div className="w-full h-auto">
          <Image
            src="/images/regles/regle1.png"
            alt="Règle 1"
            width={800}
            height={600}
            className="w-full h-auto object-contain"
          />
        </div>
        <div className="w-full h-auto">
          <Image
            src="/images/regles/regle2.png"
            alt="Règle 2"
            width={800}
            height={600}
            className="w-full h-auto object-contain"
          />
        </div>
        <div className="w-full h-auto">
          <Image
            src="/images/regles/regle3.png"
            alt="Règle 3"
            width={800}
            height={600}
            className="w-full h-auto object-contain"
          />
        </div>
        <div className="w-full h-auto">
          <Image
            src="/images/regles/regle4.png"
            alt="Règle 4"
            width={800}
            height={600}
            className="w-full h-auto object-contain"
          />
        </div>
      </main>
    </div>
  )
}
