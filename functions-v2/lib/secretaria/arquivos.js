"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ENTREGA_DIRETA = exports.semApagar = void 0;
exports.lerArquivoEnviado = lerArquivoEnviado;
exports.gravarOriginal = gravarOriginal;
exports.lerOriginal = lerOriginal;
exports.camposDoConteudo = camposDoConteudo;
exports.copiaDoConteudo = copiaDoConteudo;
exports.lerConteudo = lerConteudo;
exports.entregar = entregar;
exports.limparTemporarios = limparTemporarios;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const arquivo_1 = require("../shared/arquivo");
/**
 * Arquivos no Cloud Storage: recebimento do envio direto do navegador,
 * guarda do original sem perda, texto do editor fora do banco quando é
 * grande e entrega de arquivo grande por link de uso curto.
 */
const bucket = () => admin.storage().bucket();
const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`;
/**
 * O arquivo que a pessoa enviou: da área de espera do Storage (até 50 MB,
 * o navegador envia direto) ou, nos clientes antigos, em base64 na chamada
 * (até 5 MB). Confere dono, tamanho e se o conteúdo bate com o tipo.
 */
async function lerArquivoEnviado(p, uid, mime) {
    let buf;
    if (p.envio) {
        if (!(0, arquivo_1.envioDaConta)(p.envio, uid))
            throw new https_1.HttpsError('permission-denied', 'Envio de arquivo inválido');
        const f = bucket().file(String(p.envio));
        try {
            [buf] = await f.download();
        }
        catch (_a) {
            throw new https_1.HttpsError('not-found', 'O arquivo enviado não chegou. Envie de novo.');
        }
        await f.delete({ ignoreNotFound: true }).catch(() => undefined);
        if (buf.length > secretaria_1.MAX_UPLOAD_BYTES)
            throw new https_1.HttpsError('invalid-argument', `Arquivo acima de ${mb(secretaria_1.MAX_UPLOAD_BYTES)}`);
    }
    else {
        buf = Buffer.from(String(p.base64 || ''), 'base64');
        if (buf.length > secretaria_1.MAX_UPLOAD_BASE64_BYTES)
            throw new https_1.HttpsError('invalid-argument', `Arquivo acima de ${mb(secretaria_1.MAX_UPLOAD_BASE64_BYTES)}`);
    }
    if (!buf.length)
        throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio');
    if (!(0, arquivo_1.conteudoConfere)(buf, mime))
        throw new https_1.HttpsError('invalid-argument', 'O conteúdo do arquivo não confere com o tipo informado');
    return buf;
}
/**
 * Guarda o original exatamente como veio. Se o gzip (sem perda, os bytes
 * voltam iguais) economizar ao menos 5%, guarda compactado; o SHA-256 é
 * sempre o do original.
 */
async function gravarOriginal(path, buf, mime) {
    const gz = (0, zlib_1.gzipSync)(buf, { level: 9 });
    const compacta = gz.length <= buf.length * 0.95;
    await bucket().file(path).save(compacta ? gz : buf, {
        resumable: false,
        contentType: compacta ? 'application/gzip' : mime,
        metadata: { metadata: Object.assign({ tipo_original: mime }, (compacta ? { compactado: 'gzip' } : {})) },
    });
    return compacta ? { compactado: 'gzip', tamanho_armazenado: gz.length } : { tamanho_armazenado: buf.length };
}
/** Os bytes originais de um arquivo guardado (descompacta se preciso). */
async function lerOriginal(d) {
    const [buf] = await bucket().file(String(d.storage_path)).download();
    return d.compactado === 'gzip' ? (0, zlib_1.gunzipSync)(buf) : buf;
}
/**
 * Campos do texto do editor para gravar no documento do banco: o JSON fica
 * no próprio documento até 700 KB; acima disso vai para o Storage, num
 * arquivo por versão do texto (o hash no nome), e o banco guarda o caminho.
 */
async function camposDoConteudo(base, doc, hash) {
    const { json, noBanco } = (0, arquivo_1.conteudoParaGravar)(doc);
    if (noBanco)
        return { conteudo_json: json, conteudo_path: firestore_1.FieldValue.delete(), conteudo: firestore_1.FieldValue.delete() };
    const path = `${base}.conteudo.${hash.slice(0, 16)}.json.gz`;
    await bucket().file(path).save((0, zlib_1.gzipSync)(Buffer.from(json, 'utf8')), { resumable: false, contentType: 'application/gzip' });
    return { conteudo_path: path, conteudo_json: firestore_1.FieldValue.delete(), conteudo: firestore_1.FieldValue.delete() };
}
/** Na criação (set), FieldValue.delete() não vale: tira os campos apagados. */
const semApagar = (campos) => Object.fromEntries(Object.entries(campos).filter(([, v]) => !(v instanceof firestore_1.FieldValue)));
exports.semApagar = semApagar;
/** Os campos do texto como estão, para copiar numa versão anterior. */
function copiaDoConteudo(d) {
    return Object.fromEntries(['conteudo', 'conteudo_json', 'conteudo_path', 'delta'].filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
}
/** Texto do editor de um documento ou versão; null se for de outro formato. */
async function lerConteudo(d) {
    if (typeof d.conteudo_path === 'string' && d.conteudo_path) {
        const [buf] = await bucket().file(d.conteudo_path).download();
        return JSON.parse((0, zlib_1.gunzipSync)(buf).toString('utf8'));
    }
    return (0, arquivo_1.conteudoGravado)(d);
}
/** Até aqui o arquivo volta em base64 na própria resposta (a resposta da função tem limite de 32 MB). */
exports.MAX_ENTREGA_DIRETA = 15 * 1024 * 1024;
/**
 * Entrega um arquivo ao navegador. Pequeno: em base64 na resposta. Grande:
 * cópia temporária com token aleatório de 128 bits, entregue só a quem já
 * passou pela conferência de acesso; a cópia é apagada no mesmo dia.
 */
async function entregar(buf, nome, mime, uid) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length <= exports.MAX_ENTREGA_DIRETA)
        return { base64: b.toString('base64'), nome, mime, tamanho: b.length };
    const path = `${arquivo_1.PASTA_TEMP}/${uid}/${(0, crypto_1.randomBytes)(12).toString('hex')}`;
    const token = (0, crypto_1.randomUUID)();
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
async function apagarAntigos(prefixo, idadeMs) {
    const [arquivos] = await bucket().getFiles({ prefix: prefixo });
    const limite = Date.now() - idadeMs;
    await Promise.all(arquivos.filter((f) => new Date(String(f.metadata.timeCreated || 0)).getTime() < limite)
        .map((f) => f.delete({ ignoreNotFound: true }).catch(() => undefined)));
}
/** Entregas antigas desta conta (cada nova entrega varre as de mais de uma hora). */
const limparDaConta = (uid) => apagarAntigos(`${arquivo_1.PASTA_TEMP}/${uid}/`, UMA_HORA);
/** Rotina diária: entregas e envios abandonados há mais de uma hora. */
async function limparTemporarios() {
    await Promise.all([apagarAntigos(`${arquivo_1.PASTA_TEMP}/`, UMA_HORA), apagarAntigos(`${arquivo_1.PASTA_ENVIOS}/`, UMA_HORA)]);
}
//# sourceMappingURL=arquivos.js.map