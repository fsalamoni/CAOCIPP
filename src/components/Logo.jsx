// ============================================================================
// Logo — Imagem PNG oficial (NÃO recriar — usar o arquivo enviado pelo owner)
// ----------------------------------------------------------------------------
// Este componente renderiza a imagem PNG oficial que o owner enviou
// (arquivo `public/logo.png`, 1024×1024, fundo navy #33495C, dois cursores
// brancos entrelaçados). Não há SVG vetorial — é a imagem literal.
//
// Por que PNG e não SVG? O owner desenhou o logo à mão e aprovou o PNG
// como definitivo. Qualquer recriação em SVG é uma aproximação que
// perde fidelidade (proporções, curvaturas, anti-aliasing).
//
// Para regenerar os ícones PWA em diferentes tamanhos a partir do PNG
// original, ver `scripts/build-pwa-icons-from-png.py`.
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
};

const LOGO_SRC = '/logo.png';

export default function Logo({
  size = 'md',
  numericSize,
  showText = false,
  className = '',
  textClassName = '',
}) {
  const px = numericSize || SIZES[size] || SIZES.md;

  // Dimensões e atributos de renderização da imagem
  const imgProps = {
    src: LOGO_SRC,
    width: px,
    height: px,
    alt: 'SIGO - Sistema Interno de Gestão Operacional',
    draggable: 'false',
    decoding: 'async',
    style: { display: 'block' },
  };

  if (!showText) {
    return (
      <span className={className}>
        <img {...imgProps} />
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <img {...imgProps} />
      <span className={`flex flex-col leading-none ${textClassName}`}>
        <span className="text-xl font-bold tracking-tight" style={{ color: '#33495C' }}>
          SIGO
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase mt-0.5">
          Sistema Interno de Gestão Operacional
        </span>
      </span>
    </span>
  );
}
