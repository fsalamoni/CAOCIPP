import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

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

export const LOGO_MAX = 300 * 1024; // caracteres do data URL (cabe folgado no doc de 1 MiB)
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Contraste WCAG entre a cor e o branco (o texto do logo e do tema fica sobre branco). */
export function contrasteComBranco(hex: string): number {
    const canal = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const l = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
    return 1.05 / (l + 0.05);
}

const texto = (v: unknown, max: number, campo: string, obrigatorio = false): string => {
    const s = String(v ?? '').trim();
    if (obrigatorio && !s) throw new HttpsError('invalid-argument', `Preencha: ${campo}.`);
    if (s.length > max) throw new HttpsError('invalid-argument', `${campo}: até ${max} caracteres.`);
    return s;
};

/** Valida e normaliza a identidade enviada pelo painel. Exportada para teste. */
export function validarIdentidade(d: Record<string, any>) {
    const cor = String(d.cor || '').trim();
    if (!HEX_RE.test(cor)) throw new HttpsError('invalid-argument', 'Cor: use o formato #RRGGBB.');
    if (contrasteComBranco(cor) < 4.5) {
        throw new HttpsError('invalid-argument', 'Cor clara demais: o texto nessa cor fica ilegível sobre o branco. Escolha um tom mais escuro.');
    }
    const logo = d.logo ? String(d.logo) : null;
    if (logo && (logo.length > LOGO_MAX || !LOGO_RE.test(logo))) {
        throw new HttpsError('invalid-argument', 'Logo: imagem PNG, JPEG ou WebP de até 220 KB.');
    }
    const email = texto(d.suporte?.email, 120, 'E-mail de suporte');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail de suporte inválido.');
    const site = texto(d.suporte?.site, 200, 'Site de suporte');
    if (site && !/^https:\/\/[^\s]+$/.test(site)) throw new HttpsError('invalid-argument', 'Site de suporte: comece com https://');
    return {
        nome_curto: texto(d.nome_curto, 20, 'Nome curto', true),
        nome_completo: texto(d.nome_completo, 80, 'Nome completo', true),
        cor,
        logo,
        inicio: {
            titulo: texto(d.inicio?.titulo, 120, 'Título da tela de entrada'),
            subtitulo: texto(d.inicio?.subtitulo, 400, 'Texto da tela de entrada'),
        },
        rodape: texto(d.rodape, 200, 'Rodapé'),
        suporte: { email, telefone: texto(d.suporte?.telefone, 40, 'Telefone de suporte'), site },
    };
}

interface Pedido { action?: 'salvar' | 'publicarTermos'; identidade?: Record<string, any>; texto?: string; exigir_aceite?: boolean }

export const platformBranding = onCall<Pedido>({ region: REGION }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const ref = admin.firestore().collection('platformConfig').doc('branding');
    const p = request.data || {};

    if (p.action === 'salvar') {
        const identidade = validarIdentidade(p.identidade || {});
        await ref.set({ ...identidade, atualizado_em: FieldValue.serverTimestamp(), atualizado_por: ator.name }, { merge: true });
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_BRANDING_UPDATED', {
            nome_curto: identidade.nome_curto, cor: identidade.cor, logo: identidade.logo ? 'personalizado' : 'padrão',
        });
        return { success: true };
    }

    if (p.action === 'publicarTermos') {
        const corpo = String(p.texto || '').trim();
        if (corpo.length < 50) throw new HttpsError('invalid-argument', 'Os termos precisam ter ao menos 50 caracteres.');
        if (corpo.length > 60000) throw new HttpsError('invalid-argument', 'Os termos passam do limite de 60 mil caracteres.');
        const versao = await admin.firestore().runTransaction(async (t) => {
            const atual = (await t.get(ref)).data()?.termos?.versao;
            const nova = (Number.isInteger(atual) ? atual : 0) + 1;
            const termos = { versao: nova, texto: corpo, exigir_aceite: p.exigir_aceite === true, publicado_em: FieldValue.serverTimestamp(), publicado_por: ator.name };
            t.set(ref, { termos }, { merge: true });
            // Histórico: cada versão publicada fica guardada (só Functions e console leem).
            t.set(ref.collection('termosVersoes').doc(String(nova)), { ...termos, publicado_por_uid: ator.uid });
            return nova;
        });
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_TERMS_PUBLISHED', { versao, exigir_aceite: p.exigir_aceite === true });
        return { success: true, versao };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});
