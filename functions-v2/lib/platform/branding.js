"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformBranding = exports.LOGO_MAX = void 0;
exports.contrasteComBranco = contrasteComBranco;
exports.validarIdentidade = validarIdentidade;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * platformBranding — identidade e textos da plataforma (platformConfig/branding).
 *
 * O documento é público (a tela de entrada lê antes do login), por isso só
 * guarda o que aparece na tela. Só super-admin grava, sempre por aqui.
 *
 * Ações:
 *  - salvar:         nomes, cor, logo, textos da tela inicial, rodapé e suporte.
 *  - publicarTermos: nova versão dos termos de uso (número sobe sozinho);
 *                    com exigir_aceite, cada pessoa aceita a versão nova ao entrar.
 */
exports.LOGO_MAX = 300 * 1024; // caracteres do data URL (cabe folgado no doc de 1 MiB)
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
/** Contraste WCAG entre a cor e o branco (o texto do logo e do tema fica sobre branco). */
function contrasteComBranco(hex) {
    const canal = (i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
    return 1.05 / (l + 0.05);
}
const texto = (v, max, campo, obrigatorio = false) => {
    const s = String(v !== null && v !== void 0 ? v : '').trim();
    if (obrigatorio && !s)
        throw new https_1.HttpsError('invalid-argument', `Preencha: ${campo}.`);
    if (s.length > max)
        throw new https_1.HttpsError('invalid-argument', `${campo}: até ${max} caracteres.`);
    return s;
};
/** Valida e normaliza a identidade enviada pelo painel. Exportada para teste. */
function validarIdentidade(d) {
    var _a, _b, _c, _d, _e;
    const cor = String(d.cor || '').trim();
    if (!HEX_RE.test(cor))
        throw new https_1.HttpsError('invalid-argument', 'Cor: use o formato #RRGGBB.');
    if (contrasteComBranco(cor) < 4.5) {
        throw new https_1.HttpsError('invalid-argument', 'Cor clara demais: o texto nessa cor fica ilegível sobre o branco. Escolha um tom mais escuro.');
    }
    const logo = d.logo ? String(d.logo) : null;
    if (logo && (logo.length > exports.LOGO_MAX || !LOGO_RE.test(logo))) {
        throw new https_1.HttpsError('invalid-argument', 'Logo: imagem PNG, JPEG ou WebP de até 220 KB.');
    }
    const email = texto((_a = d.suporte) === null || _a === void 0 ? void 0 : _a.email, 120, 'E-mail de suporte');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new https_1.HttpsError('invalid-argument', 'E-mail de suporte inválido.');
    const site = texto((_b = d.suporte) === null || _b === void 0 ? void 0 : _b.site, 200, 'Site de suporte');
    if (site && !/^https:\/\/[^\s]+$/.test(site))
        throw new https_1.HttpsError('invalid-argument', 'Site de suporte: comece com https://');
    return {
        nome_curto: texto(d.nome_curto, 20, 'Nome curto', true),
        nome_completo: texto(d.nome_completo, 80, 'Nome completo', true),
        cor,
        logo,
        inicio: {
            titulo: texto((_c = d.inicio) === null || _c === void 0 ? void 0 : _c.titulo, 120, 'Título da tela de entrada'),
            subtitulo: texto((_d = d.inicio) === null || _d === void 0 ? void 0 : _d.subtitulo, 400, 'Texto da tela de entrada'),
        },
        rodape: texto(d.rodape, 200, 'Rodapé'),
        suporte: { email, telefone: texto((_e = d.suporte) === null || _e === void 0 ? void 0 : _e.telefone, 40, 'Telefone de suporte'), site },
    };
}
exports.platformBranding = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const ref = admin.firestore().collection('platformConfig').doc('branding');
    const p = request.data || {};
    if (p.action === 'salvar') {
        const identidade = validarIdentidade(p.identidade || {});
        await ref.set(Object.assign(Object.assign({}, identidade), { atualizado_em: firestore_1.FieldValue.serverTimestamp(), atualizado_por: ator.name }), { merge: true });
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_BRANDING_UPDATED', {
            nome_curto: identidade.nome_curto, cor: identidade.cor, logo: identidade.logo ? 'personalizado' : 'padrão',
        });
        return { success: true };
    }
    if (p.action === 'publicarTermos') {
        const corpo = String(p.texto || '').trim();
        if (corpo.length < 50)
            throw new https_1.HttpsError('invalid-argument', 'Os termos precisam ter ao menos 50 caracteres.');
        if (corpo.length > 60000)
            throw new https_1.HttpsError('invalid-argument', 'Os termos passam do limite de 60 mil caracteres.');
        const versao = await admin.firestore().runTransaction(async (t) => {
            var _a, _b;
            const atual = (_b = (_a = (await t.get(ref)).data()) === null || _a === void 0 ? void 0 : _a.termos) === null || _b === void 0 ? void 0 : _b.versao;
            const nova = (Number.isInteger(atual) ? atual : 0) + 1;
            const termos = { versao: nova, texto: corpo, exigir_aceite: p.exigir_aceite === true, publicado_em: firestore_1.FieldValue.serverTimestamp(), publicado_por: ator.name };
            t.set(ref, { termos }, { merge: true });
            // Histórico: cada versão publicada fica guardada (só Functions e console leem).
            t.set(ref.collection('termosVersoes').doc(String(nova)), Object.assign(Object.assign({}, termos), { publicado_por_uid: ator.uid }));
            return nova;
        });
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_TERMS_PUBLISHED', { versao, exigir_aceite: p.exigir_aceite === true });
        return { success: true, versao };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
});
//# sourceMappingURL=branding.js.map