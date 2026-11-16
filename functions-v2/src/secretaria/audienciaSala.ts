/**
 * Sala da audiência (S10). Ações `sala*` em `secretariaProcesso`:
 *   salaAudiencia  (leitura) a audiência, os convocados e o que foi registrado;
 *   salaAbrir      abre a sala no dia da audiência (ou depois);
 *   salaPresenca   marca quem está presente e quem mais compareceu;
 *   salaRegistrar  registra uma ocorrência (manifestação, depoimento, acordo...);
 *   salaRemover    tira um registro feito por engano, antes do encerramento;
 *   salaEncerrar   encerra (realizada ou não) e manda o termo à unidade, como
 *                  minuta assinada, para a juntada.
 * Lê quem vê o processo; escreve quem tem o processo consigo. A parte não lê a
 * sala: o que vale para ela é o termo juntado aos autos.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { hojeBrasil, jsonCanonico, sha256, texto } from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import { Audiencia, audienciasFuturas, nomeDaAudiencia, textoDaAudiencia } from '../shared/audiencias';
import {
    COM_QUEM, MAX_OCORRENCIAS, Ocorrencia, SalaAudiencia, convocadosDaAudiencia, documentoDoTermo, sanitizeOcorrencia, sanitizeOutros, sanitizePresencas, textoDoTermo,
} from '../shared/audienciaSala';
import { auditar } from './config';
import { COL, Contexto, erroUsuario, exigirPosse, lerProcesso, registrarMovimento } from './context';
import { marcasDoDestino } from '../shared/exigencias';

export const ACOES_SALA = ['salaAudiencia', 'salaAbrir', 'salaPresenca', 'salaRegistrar', 'salaRemover', 'salaEncerrar'];
type Payload = Record<string, unknown>;

const proximaDe = (lista: Audiencia[]) => { const x = audienciasFuturas(lista, hojeBrasil())[0]; return x ? `${x.data}T${x.hora}` : null; };

export async function acaoSalaAudiencia(c: Contexto, p: Payload): Promise<unknown> {
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const hoje = hojeBrasil();
    const audId = String(p.audiencia_id || '');

    if (p.action === 'salaAudiencia') {
        const { ref, data } = await lerProcesso(c, p.processo_id);
        const a = ((data.audiencias || []) as Audiencia[]).find((x) => x.id === audId && x.status === 'designada');
        if (!a) throw new HttpsError('not-found', 'Audiência não encontrada');
        const sala = (await ref.collection('salas').doc(a.id).get()).data() as SalaAudiencia | undefined;
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        const aberta = !!sala && !sala.encerrada_em;
        return {
            audiencia: { ...a, nome: nomeDaAudiencia(a), texto: textoDaAudiencia(a) },
            processo: { id: ref.id, numero: data.numero || '', assunto: data.assunto || '' },
            convocados: convocadosDaAudiencia(data.partes, data.nomes_polos, a),
            sala: sala || null,
            hoje,
            pode: {
                abrir: posse && !sala && a.data <= hoje,
                registrar: posse && aberta,
                encerrar: posse && (aberta || (!sala && a.data <= hoje)),
                remover: posse && aberta,
            },
        };
    }

    const r = await c.db.runTransaction(async (tx) => {
        const { ref, data } = await lerProcesso(c, p.processo_id, tx);
        exigirPosse(c, data);
        const lista = [...((data.audiencias || []) as Audiencia[])];
        const k = lista.findIndex((x) => x.id === audId && x.status === 'designada');
        if (k < 0) throw new HttpsError('not-found', 'Audiência não encontrada');
        const a = lista[k];
        const sref = ref.collection('salas').doc(a.id);
        const sala = (await tx.get(sref)).data() as SalaAudiencia | undefined;
        const convocados = convocadosDaAudiencia(data.partes, data.nomes_polos, a);
        if (sala?.encerrada_em) throw new HttpsError('failed-precondition', 'A audiência já foi encerrada: o termo está com a unidade para a juntada');
        if (a.data > hoje) throw new HttpsError('failed-precondition', `A sala abre no dia da audiência (${a.data.split('-').reverse().join('/')})`);

        if (p.action === 'salaAbrir') {
            if (sala) throw new HttpsError('already-exists', 'A sala desta audiência já está aberta');
            const nova: SalaAudiencia = { audiencia_id: a.id, aberta_em: new Date().toISOString(), aberta_por: quem, presencas: sanitizePresencas({}, convocados), outros: [], ocorrencias: [] };
            tx.set(sref, nova);
            return { ok: true, auditoria: 'SECRETARIA_AUDIENCIA_ABERTA' };
        }

        if (p.action === 'salaEncerrar') {
            const realizada = p.realizada !== false;
            const motivo = texto(p.motivo, 1000);
            if (realizada && !sala) throw new HttpsError('failed-precondition', 'Abra a sala antes: a audiência realizada tem presença e registros');
            if (!realizada && motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga por que a audiência não se realizou (ao menos 5 letras)');
            const agora = new Date().toISOString();
            const base: SalaAudiencia = sala || { audiencia_id: a.id, aberta_em: agora, aberta_por: quem, presencas: sanitizePresencas({}, convocados), outros: [], ocorrencias: [] };
            const un = (await tx.get(c.db.collection(COL.unidades).doc(String(data.unidade_atual)))).data();
            const nome = nomeDaAudiencia(a);
            const titulo = `Termo de ${nome.charAt(0).toLowerCase()}${nome.slice(1)}${realizada ? '' : ' não realizada'}`;
            const t = textoDoTermo({
                numero: String(data.numero || ''), unidade: String(un?.nome || ''), audiencia: a, condutor: base.aberta_por.nome, lavrou: quem.nome,
                convocados, sala: base, realizada, motivo, encerrada_em: agora,
            });
            let conteudo: ReturnType<typeof sanitizeDoc> | null = null;
            try { conteudo = sanitizeDoc(documentoDoTermo(titulo, t)); } catch (e) { erroUsuario(e); }
            const hash = sha256(jsonCanonico(conteudo));
            // Vai à unidade como minuta assinada por quem encerrou; a unidade junta aos autos (e o rito confere).
            const dref = ref.collection('documentos').doc();
            tx.set(dref, {
                titulo, tipo: 'Termo de audiência', status: 'minuta', unidade_origem: data.unidade_atual, autor_uid: quem.uid, autor_nome: quem.nome,
                criado_em: agora, origem: 'editor', conteudo_json: JSON.stringify(conteudo), sha256: hash, audiencia_id: a.id,
                assinaturas: [{ uid: quem.uid, nome: quem.nome, em: agora, sha256: hash, nivel: 'simples' }],
            });
            tx.set(sref, { ...base, encerrada_em: agora, realizada, ...(realizada ? {} : { motivo }), termo_documento_id: dref.id });
            lista[k] = { ...a, realizada_em: agora, realizada } as Audiencia;
            const mov = registrarMovimento(tx, c, ref, data, 'audiencia_encerrada',
                `${nome} de ${textoDaAudiencia(a, false)} ${realizada ? 'realizada' : `não realizada: ${motivo.replace(/[.\s]+$/, '')}`}. O termo foi para a juntada.`,
                { ...marcasDoDestino('informacao'), audiencia_id: a.id, documento_id_minuta: dref.id });
            tx.update(ref, { ...mov, audiencias: lista, proxima_audiencia: proximaDe(lista) });
            return { ok: true, documento_id: dref.id, auditoria: realizada ? 'SECRETARIA_AUDIENCIA_ENCERRADA' : 'SECRETARIA_AUDIENCIA_NAO_REALIZADA' };
        }

        if (!sala) throw new HttpsError('failed-precondition', 'Abra a sala da audiência antes');

        if (p.action === 'salaPresenca') {
            let outros = sala.outros;
            try { if (p.outros !== undefined) outros = sanitizeOutros(p.outros); } catch (e) { erroUsuario(e); }
            tx.update(sref, { presencas: sanitizePresencas(p.presencas, convocados), outros });
            return { ok: true };
        }

        if (p.action === 'salaRegistrar') {
            if ((sala.ocorrencias || []).length >= MAX_OCORRENCIAS) throw new HttpsError('failed-precondition', `A sala comporta até ${MAX_OCORRENCIAS} registros`);
            const presentes = [...convocados.filter((x) => sala.presencas[x.chave]).map((x) => x.nome), ...(sala.outros || []).map((x) => x.nome)];
            let campos: ReturnType<typeof sanitizeOcorrencia> | null = null;
            try { campos = sanitizeOcorrencia(p.ocorrencia, presentes); } catch (e) { erroUsuario(e); }
            const oc: Ocorrencia = { id: c.db.collection('_').doc().id, ...campos!, em: new Date().toISOString(), por: quem.nome };
            if (!COM_QUEM.includes(oc.tipo)) delete oc.quem;
            tx.update(sref, { ocorrencias: FieldValue.arrayUnion(oc) });
            return { ok: true, ocorrencia_id: oc.id };
        }

        if (p.action === 'salaRemover') {
            const oc = (sala.ocorrencias || []).find((x) => x.id === p.ocorrencia_id);
            if (!oc) throw new HttpsError('not-found', 'Registro não encontrado');
            tx.update(sref, { ocorrencias: sala.ocorrencias.filter((x) => x.id !== oc.id) });
            return { ok: true };
        }
        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    const { auditoria, ...resto } = r as { auditoria?: string } & Record<string, unknown>;
    if (auditoria) await auditar(c.db, c.orgId, quem.uid, quem.nome, auditoria, { processo_id: p.processo_id, audiencia_id: audId });
    return resto;
}

/** Termo excluído pela unidade (minuta): a sala volta a ficar aberta, para corrigir e encerrar de novo. */
export async function reabrirSala(db: admin.firestore.Firestore, procRef: admin.firestore.DocumentReference, audienciaId: string, documentoId: string): Promise<void> {
    await db.runTransaction(async (tx) => {
        const sref = procRef.collection('salas').doc(audienciaId);
        const [ps, ss] = await Promise.all([tx.get(procRef), tx.get(sref)]);
        const sala = ss.data() as SalaAudiencia | undefined;
        if (!sala || sala.termo_documento_id !== documentoId) return;
        const lista = ((ps.data()?.audiencias || []) as Array<Audiencia & { realizada_em?: string; realizada?: boolean }>)
            .map((x) => (x.id === audienciaId ? (({ realizada_em: _r, realizada: _x, ...resto }) => resto)(x) : x));
        tx.update(sref, { encerrada_em: FieldValue.delete(), realizada: FieldValue.delete(), motivo: FieldValue.delete(), termo_documento_id: FieldValue.delete() });
        tx.update(procRef, { audiencias: lista, proxima_audiencia: proximaDe(lista as Audiencia[]) });
    });
}
