import React from 'react';
import { badgeTheme, corDoDesfecho } from '@/constants/panorama';

/**
 * Etiqueta colorida de um valor de desfecho.
 *
 * A cor vem da configuração da base; texto, borda e a variante de tema escuro
 * saem dela por cálculo, de modo que qualquer cor que o órgão escolher continue
 * legível. Reaproveita as regras `.jm-resultado-badge` do index.css, que já
 * existem para a Jurimetria — as duas etiquetas são a mesma peça visual.
 */
export default function PanoramaBadge({ valor, base, cor, className = '', children, title }) {
    const texto = children ?? valor;
    if (!texto && texto !== 0) return <span className="text-slate-400">—</span>;

    const tema = badgeTheme(cor || corDoDesfecho(valor, base));

    return (
        <span
            className={`jm-resultado-badge ${className}`}
            style={{
                '--jm-bg': tema.bg,
                '--jm-text': tema.text,
                '--jm-border': tema.border,
                '--jm-dark-bg': tema.darkBg,
                '--jm-dark-text': tema.darkText,
                '--jm-dark-border': tema.darkBorder,
            }}
            title={title || String(valor || '')}
        >
            {texto}
        </span>
    );
}

/** Bolinha da cor de um desfecho — para legendas e cabeçalhos. */
export function PanoramaDot({ valor, base, className = '' }) {
    const tema = badgeTheme(corDoDesfecho(valor, base));
    return (
        <span
            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 border ${className}`}
            style={{ backgroundColor: tema.bg, borderColor: tema.border }}
            aria-hidden="true"
        />
    );
}
