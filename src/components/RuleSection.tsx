'use client';
import { useState } from 'react';

interface RuleSectionProps {
  title: string;
  children: React.ReactNode;
  iconSrc?: string;
  type?: 'default' | 'bonus_match' | 'bonus_grille';
}

export default function RuleSection({ title, children, iconSrc, type = 'default' }: RuleSectionProps) {
  const [open, setOpen] = useState(false);

  const theme =
    {
      default:      { bg: 'bg-white',      text: 'text-black', border: 'border-gray-300',  contentBg: 'bg-white' },
      bonus_match:  { bg: 'bg-blue-200',   text: 'text-black', border: 'border-blue-400',  contentBg: 'bg-blue-50' },
      bonus_grille: { bg: 'bg-yellow-200', text: 'text-black', border: 'border-yellow-400', contentBg: 'bg-yellow-50' },
    }[type];

  return (
    <div className="w-full flex justify-center">
      <div className={`w-full sm:w-4/5 md:w-3/5 mb-4 border rounded-lg shadow-sm ${theme.bg} ${theme.border}`}>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between p-4 rounded-t-lg ${theme.bg} ${theme.text}`}
        >
          <div className="flex items-center gap-2">
            {iconSrc && <img src={iconSrc} alt="" className="w-8 h-8 rounded-full" />}
            <span className="font-semibold">{title}</span>
          </div>
          <span className="text-xl">{open ? '▲' : '▼'}</span>
        </button>

        {open && <div className={`p-4 ${theme.contentBg}`}>{children}</div>}
      </div>
    </div>
  );
}
