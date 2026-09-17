import React from 'react';
import { temaDoResultado, resultadoTheme } from '@/constants/jurimetria';

/**
 * Etiqueta colorida da espécie de resultado.
 *
 * Numa tabela de centenas de júris, a espécie é o que o olho procura primeiro,
 * e a cor responde antes da leitura. A cor de fundo vem da configuração do
 * órgão; o texto e a borda saem dela por cálculo de contraste, de modo que
 * qualquer cor que o administrador escolher continue legível — inclusive no
 * tema escuro, onde o mesmo pastel aceso viraria um borrão e por isso a
 * etiqueta se inverte (fundo rebaixado, texto na cor).
 *
 * As variáveis CSS são lidas pelas regras `.jm-resultado-badge` em index.css,
 * que é o único jeito de ter uma cor dinâmica que ainda responde ao `.dark`.
 */
export default function ResultadoBadge({
    resultado,
    settings,
    cor,
    className = '',
    title,
    children,
}) {
    const texto = children ?? resultado;
    if (!texto) return <span className="text-slate-400">—</span>;

    const tema = cor ? resultadoTheme(cor) : temaDoResultado(resultado, settings);

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
            title={title || resultado || undefined}
        >
            {texto}
        </span>
    );
}

/** Bolinha da cor da espécie — para legendas e listas compactas. */
export function ResultadoDot({ resultado, settings, className = '' }) {
    const tema = temaDoResultado(resultado, settings);
    return (
        <span
            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 border ${className}`}
            style={{ backgroundColor: tema.bg, borderColor: tema.border }}
            aria-hidden="true"
        />
    );
}
