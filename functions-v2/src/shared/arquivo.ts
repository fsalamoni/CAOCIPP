/**
 * Regras puras dos arquivos do Processo Eletrônico (sem Firebase, para testar
 * direto): de onde o arquivo enviado pode vir, se o conteúdo confere com o
 * tipo declarado e como o texto do editor é guardado no banco.
 */
import type { No } from './documento';

/** Arquivo que o navegador põe na área de espera do Storage antes de chamar a função. */
export const PASTA_ENVIOS = 'secretaria-envios';
/** Arquivos grandes que a função entrega por link de uso único (apagados no mesmo dia). */
export const PASTA_TEMP = 'secretaria-temp';

/** O envio pertence a esta conta e tem o formato que o navegador gera. */
export function envioDaConta(caminho: unknown, uid: string): boolean {
    if (typeof caminho !== 'string' || !uid) return false;
    const m = /^secretaria-envios\/([^/]+)\/([A-Za-z0-9_-]{16,64})$/.exec(caminho);
    return !!m && m[1] === uid;
}

const comeca = (buf: Buffer, ...bytes: number[]) => bytes.every((b, i) => buf[i] === b);

/**
 * O conteúdo é mesmo do tipo declarado? Barra, por exemplo, um executável
 * enviado com o nome "peticao.pdf". Texto puro não pode ter byte nulo.
 */
export function conteudoConfere(buf: Buffer, mime: string): boolean {
    if (!buf.length) return false;
    switch (mime) {
        case 'application/pdf': return buf.subarray(0, 1024).includes('%PDF-');
        case 'image/png': return comeca(buf, 0x89, 0x50, 0x4e, 0x47);
        case 'image/jpeg': return comeca(buf, 0xff, 0xd8, 0xff);
        case 'application/msword': return comeca(buf, 0xd0, 0xcf, 0x11, 0xe0);
        case 'text/plain': return !buf.subarray(0, 65536).includes(0);
        default: return comeca(buf, 0x50, 0x4b); // docx, xlsx e odt são pacotes ZIP
    }
}

/**
 * Texto do editor guardado como JSON (string) no documento do banco: o
 * Firestore recusa mapas com mais de 20 níveis (uma lista dentro de tabela já
 * passa disso) e documentos acima de 1 MiB. Acima deste tamanho o texto vai
 * para o Storage e o banco guarda só o caminho.
 */
export const MAX_CONTEUDO_NO_BANCO = 700_000;

export function conteudoParaGravar(doc: No): { json: string; noBanco: boolean } {
    const json = JSON.stringify(doc);
    return { json, noBanco: Buffer.byteLength(json, 'utf8') <= MAX_CONTEUDO_NO_BANCO };
}

/** Lê o texto do editor em qualquer das formas já gravadas (mapa antigo ou JSON). */
export function conteudoGravado(d: { conteudo?: unknown; conteudo_json?: unknown }): No | null {
    if (typeof d.conteudo_json === 'string' && d.conteudo_json) return JSON.parse(d.conteudo_json) as No;
    if (d.conteudo && typeof d.conteudo === 'object') return d.conteudo as No;
    return null;
}
