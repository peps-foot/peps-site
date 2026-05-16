'use client';

import { useMemo } from 'react';
import Image from 'next/image';

const STICKERS = [
  '/images/stickers/emoji-club-foot_FRANCE-1.png',
  '/images/stickers/emoji-club-foot_FRANCE-2.png',
  '/images/stickers/emoji-club-foot_FRANCE-4.png',
  '/images/stickers/emoji-club-foot_FRANCE-6.png',
  '/images/stickers/emoji-club-foot_FRANCE-8.png',
  '/images/stickers/emoji-club-foot_FRANCE-11.png',
  '/images/stickers/emoji-club-foot_FRANCE-14.png',
];

export default function PartnerPromo() {
  const sticker = useMemo(
    () => STICKERS[Math.floor(Math.random() * STICKERS.length)],
    []
  );

return (
  <div className="border rounded-lg shadow-sm hover:shadow-md transition flex overflow-hidden mb-3 bg-white">
    {/* STICKER */}
    <div className="w-24 flex-shrink-0 flex items-center justify-center">
      <Image
        src={sticker}
        alt="Sticker supporter Sportsympathy"
        width={82}
        height={82}
        className="object-contain scale-150"
      />
    </div>

    {/* CONTENU */}
    <div className="flex-1 px-3 py-2 flex flex-col gap-1">
      <div className="font-semibold text-base leading-tight">
        🎉 Découvre Sportsympathy
      </div>

      <div className="text-sm text-gray-600 leading-tight text-justify">
        Le clavier pour supporters avec + de 5000 stickers sport.
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 max-w-xs">
        <a
          href="https://play.google.com/store/apps/details?id=com.sportsympathy.sportsympathy&hl=fr"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white text-center"
        >
          Android
        </a>

        <a
          href="https://apps.apple.com/fr/app/sportsympathy/id6504397730"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white text-center"
        >
          iOS
        </a>
      </div>
    </div>
  </div>
);
}