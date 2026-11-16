import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes, randomUUID } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';
import { HttpsError } from 'firebase-functions/v2/https';
import { MAX_UPLOAD_BASE64_BYTES, MAX_UPLOAD_BYTES } from '../shared/secretaria';
import { PASTA_ENVIOS, PASTA_TEMP, conteudoConfere, conteudoGravado, conteudoParaGravar, envioDaConta } from '../shared/arquivo';
import type { No } from '../shared/documento';

/**
 * Arquivos no Cloud Storage: recebimento do envio direto do navegador,
 * guarda do original sem perda, texto do editor fora do banco quando é
 * grande e entrega de arquivo grande por link de uso curto.
 */

const bucket = () => admin.storage().bucket();
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

/**
 * O arquivo que a pessoa enviou: da área de espera do Storage (até 50 MB,
 * o navegador envia direto) ou, nos clientes antigos, em base64 na chamada
 * (até 5 MB). Confere dono, tamanho e se o conteúdo bate com o tipo.
 */
export async function lerArquivoEnviado(p: { envio?: unknown; base64?: unknown }, uid: string, mime: string): Promise<Buffer> {
    let buf: Buffer;
    if (p.envio) {
        if (!envioDaConta(p.envio, uid)) throw new HttpsError('permission-denied', 'Envio de arquivo inválido');
        const f = bucket().file(String(p.envio));
        try { [buf] = await f.download(); } catch { throw new HttpsError('not-found', 'O arquivo enviado não chegou. Envie de novo.'); }
        await f.delete({ ignoreNotFound: true }).catch(() => undefined);
        if (buf.length > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', `Arquivo acima de ${mb(MAX_UPLOAD_BYTES)}`);
    } else {
        buf = Buffer.from(String(p.base64 || ''), 'base64');
        if (buf.length > MAX_UPLOAD_BASE64_BYTES) throw new HttpsError('invalid-argument', `Arquivo acima de ${mb(MAX_UPLOAD_BASE64_BYTES)}`);
    }
    if (!buf.length) throw new HttpsError('invalid-argument', 'Arquivo vazio');
    if (!conteudoConfere(buf, mime)) throw new HttpsError('invalid-argument', 'O conteúdo do arquivo não confere com o tipo informado');
    return buf;
}

/**
 * Guarda o original exatamente como veio. Se o gzip (sem perda, os bytes
 * voltam iguais) economizar ao menos 5%, guarda compactado; o SHA-256 é
 * sempre o do original.
 */
export async function gravarOriginal(path: string, buf: Buffer, mime: string): Promise<{ compactado?: 'gzip'; tamanho_armazenado: number }> {
    const gz = gzipSync(buf, { level: 9 });
    const compacta = gz.length <= buf.length * 0.95;
    await bucket().file(path).save(compacta ? gz : buf, {
        resumable: false,
        contentType: compacta ? 'application/gzip' : mime,
        metadata: { metadata: { tipo_original: mime, ...(compacta ? { compactado: 'gzip' } : {}) } },
    });
    return compacta ? { compactado: 'gzip', tamanho_armazenado: gz.length } : { tamanho_armazenado: buf.length };
}

/** Os bytes originais de um arquivo guardado (descompacta se preciso). */
export async function lerOriginal(d: { storage_path?: string; compactado?: string }): Promise<Buffer> {
    const [buf] = await bucket().file(String(d.storage_path)).download();
    return d.compactado === 'gzip' ? gunzipSync(buf) : buf;
}

/**
 * Campos do texto do editor para gravar no documento do banco: o JSON fica
 * no próprio documento até 700 KB; acima disso vai para o Storage, num
 * arquivo por versão do texto (o hash no nome), e o banco guarda o caminho.
 */
export async function camposDoConteudo(base: string, doc: No, hash: string): Promise<Record<string, unknown>> {
    const { json, noBanco } = conteudoParaGravar(doc);
    if (noBanco) return { conteudo_json: json, conteudo_path: FieldValue.delete(), conteudo: FieldValue.delete() };
    const path = `${base}.conteudo.${hash.slice(0, 16)}.json.gz`;
    await bucket().file(path).save(gzipSync(Buffer.from(json, 'utf8')), { resumable: false, contentType: 'application/gzip' });
    return { conteudo_path: path, conteudo_json: FieldValue.delete(), conteudo: FieldValue.delete() };
}

/** Na criação (set), FieldValue.delete() não vale: tira os campos apagados. */
export const semApagar = (campos: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(campos).filter(([, v]) => !(v instanceof FieldValue)));

/** Os campos do texto como estão, para copiar numa versão anterior. */
export function copiaDoConteudo(d: admin.firestore.DocumentData): Record<string, unknown> {
    return Object.fromEntries(['conteudo', 'conteudo_json', 'conteudo_path', 'delta'].filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
}

/** Texto do editor de um documento ou versão; null se for de outro formato. */
export async function lerConteudo(d: admin.firestore.DocumentData): Promise<No | null> {
    if (typeof d.conteudo_path === 'string' && d.conteudo_path) {
        const [buf] = await bucket().file(d.conteudo_path).download();
        return JSON.parse(gunzipSync(buf).toString('utf8')) as No;
    }
    return conteudoGravado(d);
}

/** Até aqui o arquivo volta em base64 na própria resposta (a resposta da função tem limite de 32 MB). */
export const MAX_ENTREGA_DIRETA = 15 * 1024 * 1024;

/**
 * Entrega um arquivo ao navegador. Pequeno: em base64 na resposta. Grande:
 * cópia temporária com token aleatório de 128 bits, entregue só a quem já
 * passou pela conferência de acesso; a cópia é apagada no mesmo dia.
 */
export async function entregar(buf: Buffer | Uint8Array, nome: string, mime: string, uid: string): Promise<{ base64?: string; url?: string; nome: string; mime: string; tamanho: number }> {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length <= MAX_ENTREGA_DIRETA) return { base64: b.toString('base64'), nome, mime, tamanho: b.length };
    const path = `${PASTA_TEMP}/${uid}/${randomBytes(12).toString('hex')}`;
    const token = randomUUID();
    const nomeSeguro = nome.replace(/["\\\r\n]/g, '');
    await bucket().file(path).save(b, {
        resumable: false, contentType: mime,
        metadata: { contentDisposition: `attachment; filename="${nomeSeguro}"`, cacheControl: 'private, max-age=0, no-store', metadata: { firebaseStorageDownloadTokens: token } },
    });
    limparDaConta(uid).catch(() => undefined);
    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : 'https://firebasestorage.googleapis.com';
    return { url: `${host}/v0/b/${bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`, nome, mime, tamanho: b.length };
}

const UMA_HORA = 60 * 60 * 1000;

async function apagarAntigos(prefixo: string, idadeMs: number) {
    const [arquivos] = await bucket().getFiles({ prefix: prefixo });
    const limite = Date.now() - idadeMs;
    await Promise.all(arquivos.filter((f) => new Date(String(f.metadata.timeCreated || 0)).getTime() < limite)
        .map((f) => f.delete({ ignoreNotFound: true }).catch(() => undefined)));
}

/** Entregas antigas desta conta (cada nova entrega varre as de mais de uma hora). */
const limparDaConta = (uid: string) => apagarAntigos(`${PASTA_TEMP}/${uid}/`, UMA_HORA);

/** Rotina diária: entregas e envios abandonados há mais de uma hora. */
export async function limparTemporarios() {
    await Promise.all([apagarAntigos(`${PASTA_TEMP}/`, UMA_HORA), apagarAntigos(`${PASTA_ENVIOS}/`, UMA_HORA)]);
}
