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
// Desde 17/11/2026 a administração da plataforma pode trocar nome, cor e logo
// (platformConfig/branding); sem personalização, vale este PNG oficial.
import React from 'react';
import { useBranding } from '@/lib/BrandingContext';

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
  const b = useBranding();

  // Dimensões e atributos de renderização da imagem
  const imgProps = {
    src: b.logo || LOGO_SRC,
    width: px,
    height: px,
    alt: `${b.nome_curto} - ${b.nome_completo}`,
    draggable: 'false',
    decoding: 'async',
    style: { display: 'block', objectFit: 'contain' },
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
        <span className="text-xl font-bold tracking-tight dark:!text-white" style={{ color: b.cor }}>
          {b.nome_curto}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wider uppercase mt-0.5">
          {b.nome_completo}
        </span>
      </span>
    </span>
  );
}
