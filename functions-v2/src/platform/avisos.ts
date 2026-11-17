import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

/**
 * platformAvisos — aviso para todos e modo manutenção (platformConfig/avisos,
 * leitura pública: a tela de entrada também mostra).
 *
 *  - publicarAviso:      faixa no topo de todas as telas (tom, título, texto,
 *                        link, período opcional, se pode ser dispensado). Cada
 *                        publicação ganha id novo, então reaparece para quem
 *                        dispensou a anterior.
 *  - encerrarAviso
 *  - ligarManutencao:    quem não é super-admin vê só a tela de manutenção.
 *  - desligarManutencao
 *
 * A manutenção é um bloqueio de tela, não de segurança: serve para ninguém
 * trabalhar durante uma intervenção. As regras e Functions seguem valendo.
 */

const TONS = ['info', 'alerta', 'critico'] as const;

const texto = (v: unknown, max: number, campo: string, obrigatorio = false): string => {
    const s = String(v ?? '').trim();
    if (obrigatorio && !s) throw new HttpsError('invalid-argument', `Preencha: ${campo}.`);
    if (s.length > max) throw new HttpsError('invalid-argument', `${campo}: até ${max} caracteres.`);
    return s;
};

const data = (v: unknown, campo: string): string | null => {
    if (!v) return null;
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) throw new HttpsError('invalid-argument', `${campo}: data inválida.`);
    return d.toISOString();
};

/** Valida o aviso enviado pelo painel. Exportada para teste. */
export function validarAviso(a: Record<string, any>) {
    const tom = TONS.includes(a.tom) ? a.tom : null;
    if (!tom) throw new HttpsError('invalid-argument', 'Escolha o tom do aviso.');
    const link_url = texto(a.link_url, 300, 'Link');
    if (link_url && !/^(https:\/\/|\/)[^\s]*$/.test(link_url)) throw new HttpsError('invalid-argument', 'Link: comece com https:// ou com / (página do SIGO).');
    const inicio = data(a.inicio, 'Início');
    const fim = data(a.fim, 'Fim');
    if (inicio && fim && fim <= inicio) throw new HttpsError('invalid-argument', 'O fim precisa ser depois do início.');
    return {
        tom,
        titulo: texto(a.titulo, 100, 'Título', true),
        texto: texto(a.texto, 600, 'Texto'),
        link_url,
        link_rotulo: link_url ? texto(a.link_rotulo, 40, 'Texto do link') || 'Saiba mais' : '',
        inicio,
        fim,
        dispensavel: a.dispensavel !== false,
    };
}

interface Pedido { action?: string; aviso?: Record<string, any>; mensagem?: string; previsao?: string }

export const platformAvisos = onCall<Pedido>({ region: REGION }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const ref = admin.firestore().collection('platformConfig').doc('avisos');
    const p = request.data || {};
    const quem = { por: ator.name, em: FieldValue.serverTimestamp() };

    switch (p.action) {
        case 'publicarAviso': {
            const aviso = { ...validarAviso(p.aviso || {}), id: ref.collection('x').doc().id, ativo: true, ...quem };
            await ref.set({ aviso }, { merge: true });
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_NOTICE_PUBLISHED', { titulo: aviso.titulo, tom: aviso.tom, inicio: aviso.inicio, fim: aviso.fim });
            return { success: true, id: aviso.id };
        }
        case 'encerrarAviso':
            await ref.set({ aviso: { ativo: false, encerrado_por: ator.name, encerrado_em: FieldValue.serverTimestamp() } }, { merge: true });
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_NOTICE_ENDED', {});
            return { success: true };
        case 'ligarManutencao': {
            const manutencao = {
                ativa: true,
                mensagem: texto(p.mensagem, 400, 'Mensagem') || 'O sistema está em manutenção. Volte em instantes.',
                previsao: data(p.previsao, 'Previsão de volta'),
                ...quem,
            };
            await ref.set({ manutencao }, { merge: true });
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_MAINTENANCE_ON', { previsao: manutencao.previsao });
            return { success: true };
        }
        case 'desligarManutencao':
            await ref.set({ manutencao: { ativa: false, desligada_por: ator.name, desligada_em: FieldValue.serverTimestamp() } }, { merge: true });
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_MAINTENANCE_OFF', {});
            return { success: true };
        default:
            throw new HttpsError('invalid-argument', 'Ação desconhecida.');
    }
});
