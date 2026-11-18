"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIPOS_DOCUMENTO_PADRAO = exports.MAX_LAYOUT = exports.MAX_BRASAO = void 0;
exports.sanitizeDocumentoConfig = sanitizeDocumentoConfig;
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const layoutDocumento_1 = require("../shared/layoutDocumento");
exports.MAX_BRASAO = 300 * 1024;
/** Página, cabeçalho/rodapé (com imagens) e estilos do timbrado: o registro do Firestore tem limite de 1 MB. */
exports.MAX_LAYOUT = 600 * 1024;
exports.TIPOS_DOCUMENTO_PADRAO = [
    'Despacho', 'Decisão', 'Informação', 'Certidão', 'Ofício', 'Memorando', 'Parecer', 'Termo', 'Ata', 'Relatório', 'Notificação', 'Documento',
];
/** Cabeçalho, rodapé, fonte e tipos de documento (lista fechada). */
function sanitizeDocumentoConfig(v, opts = {}) {
    const o = (v && typeof v === 'object' ? v : {});
    const brasao = typeof o.brasao === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(o.brasao) ? o.brasao : null;
    if (brasao && brasao.length * 0.75 > exports.MAX_BRASAO)
        throw new Error('O brasão passa de 300 KB; use uma imagem menor');
    const linhas = (Array.isArray(o.cabecalho_linhas) ? o.cabecalho_linhas : []).map((l) => (0, secretaria_1.texto)(l, 120)).filter(Boolean).slice(0, 4);
    const tipos = [...new Set((Array.isArray(o.tipos_documento) ? o.tipos_documento : []).map((t) => (0, secretaria_1.texto)(t, 60)).filter(Boolean))].slice(0, 60);
    const tamanho = Number(o.tamanho_padrao);
    // null (e não ausente): a unidade com timbrado próprio não herda o layout do órgão.
    const layout = (0, layoutDocumento_1.sanitizeLayout)(o.layout) || null;
    if (layout && JSON.stringify(layout).length > exports.MAX_LAYOUT)
        throw new Error('O cabeçalho e o rodapé passam de 600 KB; use imagens menores');
    return {
        layout,
        cabecalho_linhas: linhas,
        brasao,
        rodape: (0, secretaria_1.texto)(o.rodape, 200),
        fonte_padrao: documento_1.FONTES[String(o.fonte_padrao)] ? String(o.fonte_padrao) : 'serif',
        tamanho_padrao: tamanho >= 9 && tamanho <= 16 ? tamanho : 12,
        tipos_documento: tipos.length || opts.semTiposPadrao ? tipos : exports.TIPOS_DOCUMENTO_PADRAO,
    };
}
//# sourceMappingURL=documentoConfig.js.map