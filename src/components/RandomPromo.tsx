'use client';
import { useMemo } from 'react';
import Image from 'next/image';

const PROMOS = [
  { src: '/images/pubs/peps_pub1.png', alt: 'Affiche PEPS 1' },
  { src: '/images/pubs/peps_pub2.png', alt: 'Affiche PEPS 2' },
  { src: '/images/pubs/peps_pub3.png', alt: 'Affiche PEPS 3' },
  { src: '/images/pubs/peps_pub4.png', alt: 'Affiche PEPS 4' },
  { src: '/images/pubs/peps_pub5.png', alt: 'Affiche PEPS 5' },
];

export default function RandomPromo() {
  const promo = useMemo(() => PROMOS[Math.floor(Math.random() * PROMOS.length)], []);
  return (
    // pas de border, pas de bg, pas de padding, pas d'overflow-hidden
    <div className="mb-6">
      <Image
        src={promo.src}
        alt={promo.alt}
        width={1860}    // ratio type, pas besoin que ce soit exact
        height={800}
        sizes="100vw"
        className="block w-full h-auto"  // 100% largeur, hauteur auto → aucune coupe
        priority
        // unoptimized // décommente si tu es en output:'export'
      />
    </div>
  );
}
