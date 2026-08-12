// ============================================================================
// Logo — Símbolo "fluxo" oficial SIGO (dois cursores entrelaçados)
// ----------------------------------------------------------------------------
// Logo oficial aprovado: dois cursores brancos entrelaçados sobre fundo
// navy sólido #33495C. Design 100% flat, sem gradiente, sem brilho — fiel
// ao Design System V2 Minimalista (docs/DESIGN_SYSTEM_V2.md).
//
// Anatomia do símbolo (em viewBox 64x64):
//   • Cursor 1 (superior): cabeça de "play" arredondada apontando para a
//     DIREITA + haste descendo para BAIXO. Posicionado no canto
//     superior-esquerdo.
//   • Cursor 2 (inferior): cabeça de "play" arredondada apontando para a
//     ESQUERDA + haste subindo para CIMA. Posicionado no canto
//     inferior-direito.
//   • As duas hastes se cruzam no centro, formando um padrão de
//     entrelaçamento simétrico que sugere conexão, fluxo, continuidade.
//
// Vetorial — renderiza em qualquer tamanho sem perda.
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

export const LOGO_NAVY = '#33495C';
export const LOGO_WHITE = '#FFFFFF';

export default function Logo({
  size = 'md',
  numericSize,
  showText = false,
  dark = false,
  plain = false,
  className = '',
  textClassName = '',
}) {
  const px = numericSize || SIZES[size] || SIZES.md;
  const bg = dark ? LOGO_WHITE : LOGO_NAVY;
  const fg = dark ? LOGO_NAVY : LOGO_WHITE;

  // ============================================================
  // Símbolo: dois cursores (estilo media-play) entrelaçados.
  //
  // Cada cursor = uma cabeça de seta arredondada + uma haste
  // arredondada saindo da parte de trás da cabeça.
  //
  // Cursor 1 (top-left): cabeça aponta para a DIREITA,
  //   haste desce para BAIXO a partir da base da cabeça.
  // Cursor 2 (bottom-right): cabeça aponta para a ESQUERDA,
  //   haste sobe para CIMA a partir da base da cabeça.
  //
  // Os dois se cruzam no centro (as hastes se sobrepõem em X).
  // ============================================================

  const glyph = (
    <g fill={fg}>
      {/* Haste do cursor 1 (desce do centro para baixo-esquerda) */}
      <rect
        x="15"
        y="24"
        width="9"
        height="30"
        rx="4.5"
        ry="4.5"
        transform="rotate(-20 19.5 39)"
      />

      {/* Cabeça de seta do cursor 1: aponta para a DIREITA, topo-esquerdo */}
      <path
        d="M 18 8
           C 16 6.5 13 8 13 10.5
           L 13 28.5
           C 13 31 16 32.5 18 31
           L 33 24
           C 35.5 22.7 35.5 19.3 33 18
           Z"
      />

      {/* Haste do cursor 2 (sobe do centro para cima-direita) — espelhado */}
      <rect
        x="40"
        y="10"
        width="9"
        height="30"
        rx="4.5"
        ry="4.5"
        transform="rotate(-20 44.5 25)"
      />

      {/* Cabeça de seta do cursor 2: aponta para a ESQUERDA, base-direita */}
      <path
        d="M 46 56
           C 48 57.5 51 56 51 53.5
           L 51 35.5
           C 51 33 48 31.5 46 33
           L 31 40
           C 28.5 41.3 28.5 44.7 31 46
           Z"
      />
    </g>
  );

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="SIGO"
    >
      {plain ? null : (
        <rect
          x="0"
          y="0"
          width="64"
          height="64"
          rx="14"
          ry="14"
          fill={bg}
        />
      )}
      {glyph}
    </svg>
  );

  if (!showText) {
    return <span className={className}>{svg}</span>;
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {svg}
      <span className={`flex flex-col leading-none ${textClassName}`}>
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: LOGO_NAVY }}
        >
          SIGO
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase mt-0.5">
          Sistema Interno de Gestão Operacional
        </span>
      </span>
    </span>
  );
}
