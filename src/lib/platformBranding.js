// Identidade da plataforma: padrões e ajudas puras (testadas em platformBranding.test.js).
// O que o super-admin salva fica em platformConfig/branding (Function platformBranding);
// campo vazio usa o padrão abaixo.

export const BRANDING_PADRAO = Object.freeze({
    nome_curto: 'SIGO',
    nome_completo: 'Sistema Interno de Gestão Operacional',
    cor: '#33495C',
    logo: null,
    inicio: {
        titulo: '',
        subtitulo: 'Plataforma completa para controle, análise e acompanhamento de processos. Organize seu fluxo de trabalho com eficiência e transparência.',
    },
    rodape: '',
    suporte: { email: '', telefone: '', site: '' },
    termos: null,
});

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

/** Junta o documento salvo com os padrões, campo a campo. */
export function mesclarBranding(salvo) {
    const s = salvo || {};
    const P = BRANDING_PADRAO;
    const pick = (v, p) => (vazio(v) ? p : v);
    return {
        nome_curto: pick(s.nome_curto, P.nome_curto),
        nome_completo: pick(s.nome_completo, P.nome_completo),
        cor: pick(s.cor, P.cor),
        logo: s.logo || null,
        inicio: {
            titulo: pick(s.inicio?.titulo, P.inicio.titulo),
            subtitulo: pick(s.inicio?.subtitulo, P.inicio.subtitulo),
        },
        rodape: pick(s.rodape, P.rodape),
        suporte: { email: s.suporte?.email || '', telefone: s.suporte?.telefone || '', site: s.suporte?.site || '' },
        termos: s.termos?.versao ? s.termos : null,
    };
}

/** Contraste WCAG da cor com o branco (mesma conta da Function). */
export function contrasteComBranco(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return 0;
    const canal = (i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
    return 1.05 / (l + 0.05);
}

/** A pessoa precisa aceitar a versão atual dos termos? */
export function precisaAceitarTermos(branding, perfil) {
    const t = branding?.termos;
    if (!t?.exigir_aceite || !t.versao) return false;
    return Number(perfil?.termos_versao_aceita || 0) < t.versao;
}

export const LOGO_MAX_BYTES = 220 * 1024;
