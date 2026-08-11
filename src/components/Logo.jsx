// ============================================================================
// Logo — Seta de "seguir em frente" estilizada
// ----------------------------------------------------------------------------
// Logo da SIGO. SVG vetorial — renderiza em qualquer tamanho com nitidez.
// Design:
//   - Fundo rounded gradient indigo→violet
//   - 3 partículas brancas crescentes (progresso)
//   - Linha vertical tracejada (timeline)
//   - Seta principal apontando para frente
//   - Brilho sutil no canto superior direito
//
// Tamanhos suportados: 24, 32, 40, 48, 64, 96, 128, 192, 512
// ============================================================================
import React from 'react';

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
  '3xl': 128,
  pwa: 192,
  pwaLarge: 512,
};

export default function Logo({
  size = 'md',
  numericSize,
  showText = false,
  textClassName = '',
  className = '',
}) {
  const px = numericSize || SIZES[size] || SIZES.md;
  const gradId = React.useId();
  const arrowGradId = React.useId();

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SIGO"
    >
      <defs>
        <linearGradient id={`bg-${gradId}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id={`arrow-${arrowGradId}`} x1="20" y1="32" x2="48" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`shine-${gradId}`} cx="46" cy="18" r="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`shadow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      {/* Fundo rounded gradient */}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={`url(#bg-${gradId})`} />

      {/* Brilho de luz no canto superior direito */}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={`url(#shine-${gradId})`} />

      {/* Linha vertical tracejada (timeline / progresso) */}
      <line
        x1="14"
        y1="20"
        x2="14"
        y2="44"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />

      {/* 3 partículas crescentes (progresso) */}
      <circle cx="14" cy="20" r="1.6" fill="#ffffff" fillOpacity="0.55" />
      <circle cx="14" cy="32" r="1.9" fill="#ffffff" fillOpacity="0.8" />
      <circle cx="14" cy="44" r="2.2" fill="#ffffff" fillOpacity="1" />

      {/* Seta principal (sólida + sombra) */}
      <path
        d="M 24 22 L 46 32 L 24 42"
        stroke="#1e1b4b"
        strokeOpacity="0.15"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0, 1.5)"
        filter={`url(#shadow-${gradId})`}
      />
      <path
        d="M 24 22 L 46 32 L 24 42"
        stroke={`url(#arrow-${arrowGradId})`}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!showText) {
    return <span className={className}>{svg}</span>;
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {svg}
      <span className={`flex flex-col leading-none ${textClassName}`}>
        <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
          SIGO
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase mt-0.5">
          Sistema Interno de Gestão Operacional
        </span>
      </span>
    </span>
  );
}
