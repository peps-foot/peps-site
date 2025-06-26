'use client';
import { useState } from 'react';

interface RuleSectionProps {
  title: string;
  children: React.ReactNode;
  iconSrc?: string;
  type?: 'default' | 'bonus'; // par défaut = blanc, bonus = bleu
}

export default function RuleSection({ title, children, iconSrc, type = 'default' }: RuleSectionProps) {
  const [open, setOpen] = useState(false);

  const bgColor = type === 'bonus' ? 'bg-blue-200' : 'bg-white';
  const textColor = type === 'bonus' ? 'text-black' : 'text-black';
  const borderColor = type === 'bonus' ? 'border-blue-400' : 'border-gray-300';

  return (
    <div className="w-full flex justify-center">
      <div className={`w-full sm:w-4/5 md:w-3/5 mb-4 border rounded-lg shadow-sm ${bgColor} ${borderColor}`}>
        <button
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between p-4 rounded-t-lg ${bgColor} ${textColor}`}
        >
          <div className="flex items-center gap-2">
            {iconSrc && <img src={iconSrc} alt="Icon" className="w-8 h-8 rounded-full" />}
            <span className="font-semibold">{title}</span>
          </div>
          <span className="text-xl"> {open ? '▲' : '▼'} </span>
        </button>
        {open && <div className="p-4 bg-white">{children}</div>}
      </div>
    </div>
  );
}
