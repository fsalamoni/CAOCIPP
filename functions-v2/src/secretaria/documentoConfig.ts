import { texto } from '../shared/secretaria';
import { FONTES } from '../shared/documento';

export const MAX_BRASAO = 300 * 1024;
export const TIPOS_DOCUMENTO_PADRAO = [
    'Despacho', 'Decisão', 'Informação', 'Certidão', 'Ofício', 'Memorando', 'Parecer', 'Termo', 'Ata', 'Relatório', 'Notificação', 'Documento',
];

/** Cabeçalho, rodapé, fonte e tipos de documento (lista fechada). */
export function sanitizeDocumentoConfig(v: unknown, opts: { semTiposPadrao?: boolean } = {}) {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const brasao = typeof o.brasao === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(o.brasao) ? o.brasao : null;
    if (brasao && brasao.length * 0.75 > MAX_BRASAO) throw new Error('O brasão passa de 300 KB; use uma imagem menor');
    const linhas = (Array.isArray(o.cabecalho_linhas) ? o.cabecalho_linhas : []).map((l) => texto(l, 120)).filter(Boolean).slice(0, 4);
    const tipos = [...new Set((Array.isArray(o.tipos_documento) ? o.tipos_documento : []).map((t) => texto(t, 60)).filter(Boolean))].slice(0, 60);
    const tamanho = Number(o.tamanho_padrao);
    return {
        cabecalho_linhas: linhas,
        brasao,
        rodape: texto(o.rodape, 200),
        fonte_padrao: FONTES[String(o.fonte_padrao)] ? String(o.fonte_padrao) : 'serif',
        tamanho_padrao: tamanho >= 9 && tamanho <= 16 ? tamanho : 12,
        tipos_documento: tipos.length || opts.semTiposPadrao ? tipos : TIPOS_DOCUMENTO_PADRAO,
    };
}
