// src/components/AndroidBatteryGuide.tsx
// Affiche un guide d'aide pour les constructeurs Android qui tuent les apps en arrière-plan
// (Xiaomi, Huawei, Samsung, OnePlus, Oppo, Vivo, Realme)
'use client';

import { useEffect, useState } from 'react';

type Brand = {
  name: string;
  steps: string[];
  setting?: string; // nom du paramètre à chercher dans les réglages
};

const BRANDS: Record<string, Brand> = {
  xiaomi: {
    name: 'Xiaomi / Redmi / POCO',
    setting: 'Économiseur de batterie',
    steps: [
      'Ouvre les Réglages de ton téléphone',
      'Va dans "Applications" → cherche "PEPS" (ou peps-foot)',
      'Appuie sur "Économiseur de batterie"',
      'Choisis "Aucune restriction"',
      'Reviens dans Applications → PEPS → "Autorisations" → active "Démarrage automatique"',
    ],
  },
  huawei: {
    name: 'Huawei / Honor',
    setting: 'Lancement des applications',
    steps: [
      'Ouvre les Réglages',
      'Va dans "Applications" → "Lancement des applications"',
      'Trouve PEPS et désactive la gestion automatique',
      'Coche manuellement : "Démarrage automatique", "Démarrage secondaire", "Exécution en arrière-plan"',
    ],
  },
  samsung: {
    name: 'Samsung',
    setting: 'Optimisation batterie',
    steps: [
      'Ouvre les Réglages',
      'Va dans "Batterie et maintenance de l\'appareil" → "Batterie"',
      'Appuie sur "Limites utilisation arrière-plan"',
      'Vérifie que PEPS n\'est PAS dans la liste "Applications suspendues"',
      'Sinon : "Paramètres avancés" → "Optimisation batterie" → cherche PEPS → "Ne pas optimiser"',
    ],
  },
  oneplus: {
    name: 'OnePlus / Oppo / Realme',
    setting: 'Gestion de batterie',
    steps: [
      'Ouvre les Réglages',
      'Va dans "Batterie" → "Optimisation de batterie"',
      'Cherche PEPS et sélectionne "Ne pas optimiser"',
      'Va aussi dans "Applications" → PEPS → "Économie d\'énergie" → désactive',
    ],
  },
  vivo: {
    name: 'Vivo',
    setting: 'Gestion énergie',
    steps: [
      'Ouvre les Réglages',
      'Va dans "Plus de paramètres" → "Gestion des applications"',
      'Cherche PEPS → "Économie d\'énergie" → sélectionne "Aucune restriction"',
      'Active aussi "Autoriser l\'activité en arrière-plan"',
    ],
  },
};

/** Détecte la marque depuis le userAgent Android */
function detectBrand(): Brand | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  // On n'est sur Android que si "android" est dans le UA
  if (!ua.includes('android')) return null;

  if (ua.includes('xiaomi') || ua.includes('redmi') || ua.includes('poco')) return BRANDS.xiaomi;
  if (ua.includes('huawei') || ua.includes('honor') || ua.includes('hmscore')) return BRANDS.huawei;
  if (ua.includes('samsung') || ua.includes('sm-')) return BRANDS.samsung;
  if (ua.includes('oneplus') || ua.includes('oppo') || ua.includes('realme') || ua.includes('cph')) return BRANDS.oneplus;
  if (ua.includes('vivo')) return BRANDS.vivo;

  return null; // Autre Android (Pixel, Sony…) — moins de problèmes, pas de guide nécessaire
}

export default function AndroidBatteryGuide() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setBrand(detectBrand());
  }, []);

  // Pas sur un Android à marque problématique → on n'affiche rien
  if (!brand) return null;

  return (
    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-orange-800">
            📱 {brand.name} détecté
          </p>
          <p className="text-xs text-orange-700 mt-0.5">
            Les téléphones {brand.name.split('/')[0].trim()} bloquent souvent les notifications en arrière-plan.
            Si tu ne reçois pas les notifs PEPS, suis ces étapes :
          </p>
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className="shrink-0 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {open ? 'Masquer' : 'Voir le guide'}
        </button>
      </div>

      {open && (
        <ol className="mt-3 space-y-2 pl-1">
          {brand.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-xs text-orange-900">
              <span className="shrink-0 font-bold">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
          <li className="flex gap-2 text-xs text-orange-900 mt-2 pt-2 border-t border-orange-200">
            <span className="shrink-0">💡</span>
            <span>
              Après ces réglages, <strong>ferme et relance PEPS</strong> depuis ton écran d&apos;accueil
              pour que les changements soient pris en compte.
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}
