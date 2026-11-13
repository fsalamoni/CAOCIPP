import { HttpsError } from 'firebase-functions/v2/https';
import { COL, Contexto, exigirAdmin, registrarMovimento } from './context';
import { marcasDoDestino } from '../shared/exigencias';
import { gruposDaMigracao, migrarEstado } from '../shared/migrarRito';
import type { Fase } from '../shared/secretaria';

type Payload = Record<string, unknown>;
type Auditar = (action: string, details: Record<string, unknown>) => Promise<void>;

/** Situações em que o processo ainda anda pelo rito (arquivado e excluído ficam como estão). */
const SITUACOES = ['em_tramitacao', 'sobrestado'];
// ponytail: uma transação por processo; acima disso, "Atualizar" de novo continua de onde parou.
const MAX_POR_VEZ = 300;
const MAX_PREVIA = 2000;

/**
 * `migrarRito {rito_id, simular?, destinos?}` (admin): leva os processos em
 * andamento de versões anteriores para a versão atual do rito. `simular`
 * devolve os grupos (versão e fase atual) e as fases da versão atual; sem ele,
 * grava. Fase que não existe mais pede destino (`destinos[faseAntiga] =
 * faseNova`). Cada processo ganha um registro no extrato, fora dos autos e do
 * portal; nada do que já está nos autos muda.
 */
export async function migrarRito(c: Contexto, p: Payload, auditar: Auditar) {
    exigirAdmin(c);
    const ritoRef = c.db.collection(COL.ritos).doc(String(p.rito_id || '_'));
    const ritoSnap = await ritoRef.get();
    const rito = ritoSnap.data();
    if (!rito || rito.organization_id !== c.orgId || rito.excluido === true) throw new HttpsError('not-found', 'Rito não encontrado');
    const versao = Number(rito.versao) || 1;
    const novas = (rito.fases || []) as Fase[];
    if (!novas.length) throw new HttpsError('failed-precondition', 'O rito não tem fases');
    const snap = await c.db.collection(COL.processos).where('organization_id', '==', c.orgId).where('rito_id', '==', ritoRef.id)
        .where('status', 'in', SITUACOES).where('rito_versao', '<', versao).select('rito_versao', 'fase_atual', 'fases').limit(MAX_PREVIA).get();
    // Toda autuação grava rito_versao (processos.ts); o filtro abaixo só protege contra valor estranho.
    const antigos = snap.docs.filter((d) => (Number(d.data().rito_versao) || 1) < versao);
    const grupos = gruposDaMigracao(antigos.map((d) => d.data()), novas);
    if (p.simular === true) {
        return { versao, nome: rito.nome, fases: novas.map((f) => ({ id: f.id, nome: f.nome })), grupos, total: antigos.length, cortado: snap.size >= MAX_PREVIA };
    }
    const destinos = (p.destinos && typeof p.destinos === 'object' ? p.destinos : {}) as Record<string, unknown>;
    const ids = new Set(novas.map((f) => f.id));
    const destinoDe = (faseId: string): string | null => {
        if (ids.has(faseId)) return faseId;
        const d = String(destinos[faseId] || '');
        return ids.has(d) ? d : null;
    };
    const semDestino = grupos.filter((g) => !g.existe && !destinoDe(g.fase_id));
    if (semDestino.length) {
        throw new HttpsError('invalid-argument', `Escolha a fase da versão ${versao} para quem está em: ${[...new Set(semDestino.map((g) => g.fase_nome))].join(', ')}.`);
    }
    let atualizados = 0;
    for (const d of antigos.slice(0, MAX_POR_VEZ)) {
        const feito = await c.db.runTransaction(async (tx) => {
            const atual = (await tx.get(d.ref)).data();
            // Relido na transação: só segue se ainda está no rito, em andamento e numa versão anterior.
            if (!atual || atual.rito_id !== ritoRef.id || !SITUACOES.includes(atual.status) || (Number(atual.rito_versao) || 1) >= versao) return false;
            const destino = destinoDe(String(atual.fase_atual || ''));
            if (!destino) return false;
            const de = Number(atual.rito_versao) || 1;
            const faseAntiga = ((atual.fases || []) as Fase[]).find((f) => f.id === atual.fase_atual)?.nome || String(atual.fase_atual || '');
            const est = migrarEstado(atual, novas, destino);
            const faseNova = novas.find((f) => f.id === destino)?.nome || destino;
            const texto = `Rito ${rito.nome} atualizado da versão ${de} para a ${versao} por decisão do admin do órgão.`
                + (est.mudou_de_fase ? ` A fase ${faseAntiga}, que deixou de existir, passou a ${faseNova}.` : '');
            const mov = registrarMovimento(tx, c, d.ref, atual, 'rito_atualizado', texto, {
                ...marcasDoDestino('informacao'), visivel_partes: false, de_versao: de, para_versao: versao,
                ...(est.mudou_de_fase ? { fase_de: atual.fase_atual, fase_para: destino } : {}),
            });
            tx.update(d.ref, {
                ...mov, rito_nome: rito.nome, rito_versao: versao, fases: est.fases, fase_atual: est.fase_atual,
                acoes_feitas: est.acoes_feitas, acoes_respostas: est.acoes_respostas, exigencias_cumpridas: est.exigencias_cumpridas,
            });
            return true;
        });
        if (feito) atualizados += 1;
    }
    const restantes = Math.max(0, antigos.length - MAX_POR_VEZ);
    await auditar('SECRETARIA_RITO_PROCESSOS_ATUALIZADOS', { rito_id: ritoRef.id, nome: rito.nome, versao, processos: atualizados, restantes });
    return { atualizados, restantes, versao };
}
