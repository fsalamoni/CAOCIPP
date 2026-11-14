// ============================================================================
// Prazos que a fase abre sozinha além do dela: o prazo de cada ação, a
// antecedência do alerta e o que fazer quando vencem. Lógica pura, testada em
// test/efeitosFase.test.js.
// ============================================================================
import { randomBytes } from 'crypto';
import { CalendarioOrgao, Contagem, Fase, MAX_ITENS, MAX_PRAZO_DIAS, Pendencia, Prazo, calcularVencimento, derivados, hojeBrasil, somarDias } from './secretaria';
import { acaoAtiva, alternativaCumprida, respostasDaFase } from './exigencias';
import { ALERTA_PADRAO } from './efeitosFase';

const br = (iso: string) => iso.split('-').reverse().join('/');

/** O que todo prazo aberto pela fase leva: a antecedência do alerta e a regra do vencimento, como estavam no rito. */
export function marcasDoPrazo(f: Pick<Fase, 'prazo_alerta_dias' | 'prazo_vencido'>): Record<string, unknown> {
    return {
        ...(typeof f.prazo_alerta_dias === 'number' ? { alerta_dias: f.prazo_alerta_dias } : {}),
        ...(f.prazo_vencido ? { ao_vencer: f.prazo_vencido } : {}),
    };
}

interface ProcPrazos { prazos?: unknown; acoes_feitas?: unknown; [k: string]: unknown }

/**
 * Prazos das ações da fase em que o processo está, conforme o que já foi
 * feito e respondido: abre o da ação que vale e ainda não foi cumprida, encerra
 * o da cumprida, cancela o da que deixou de valer e reabre (com o vencimento
 * original) o da ação desfeita. Prazo que alguém encerrou à mão fica como está.
 * Devolve null quando nada muda.
 */
export function prazosDasAcoes(
    proc: ProcPrazos, fase: Fase | undefined, hoje: string, agora: string, calendario: CalendarioOrgao | undefined, quem: string, novoId: () => string,
): { prazos: Prazo[]; notas: string[] } | null {
    const regras = fase?.acoes_regras || [];
    if (!fase || !regras.some((r) => r?.prazo_dias)) return null;
    const feitas = new Set<number>(((proc.acoes_feitas || {}) as Record<string, number[]>)[fase.id] || []);
    const resp = respostasDaFase(proc as never);
    let prazos = (Array.isArray(proc.prazos) ? proc.prazos : []) as Prazo[];
    const notas: string[] = [];
    regras.forEach((r, i) => {
        const acao = fase.acoes?.[i];
        const dias = Number(r?.prazo_dias);
        if (!acao || !Number.isInteger(dias) || dias < 1 || dias > MAX_PRAZO_DIAS) return;
        const feita = feitas.has(i);
        const quer = !feita && acaoAtiva(fase, i, resp) && !alternativaCumprida(fase, i, feitas, resp);
        const daRodada = prazos.filter((x) => x.fase_id === fase.id && x.acao_idx === i && x.rodada_fim !== true);
        const aberto = daRodada.find((x) => x.status === 'aberto');
        if (aberto && !quer) {
            const status = feita ? 'cumprido' as const : 'cancelado' as const;
            prazos = prazos.map((x) => (x === aberto ? { ...x, status, encerrado_em: hoje, encerrado_por: quem, pela_regra: true } : x));
            notas.push(feita
                ? `Prazo da ação "${acao}" cumprido ${hoje <= aberto.vence_em ? 'no prazo' : 'fora do prazo'}.`
                : `Prazo da ação "${acao}" cancelado: ela deixou de valer.`);
            return;
        }
        if (aberto || !quer) return;
        const anterior = daRodada[daRodada.length - 1];
        if (anterior) {
            // Encerrado à mão: a decisão de quem encerrou vale.
            if (anterior.pela_regra !== true) return;
            // Desfeito o cumprimento, vale o vencimento de antes; a ação que deixou de valer e volta conta de novo.
            const recontar = anterior.status === 'cancelado';
            const cont: Contagem = anterior.contagem === 'corridos' ? 'corridos' : 'uteis';
            const novoVence = recontar ? calcularVencimento(hoje, Number(anterior.dias) || dias, cont, calendario) : anterior.vence_em;
            prazos = prazos.map((x) => {
                if (x !== anterior) return x;
                const { encerrado_em: _e, encerrado_por: _p, pela_regra: _r, vencido_tratado_em: _v, ...resto } = x;
                return { ...resto, status: 'aberto' as const, ...(recontar ? { inicio: hoje, vence_em: novoVence } : {}) } as Prazo;
            });
            notas.push(`Prazo da ação "${acao}" reaberto: vence em ${br(novoVence)}.`);
            return;
        }
        if (prazos.length >= MAX_ITENS) return;
        const contagem: Contagem = r?.prazo_contagem === 'corridos' ? 'corridos' : 'uteis';
        const vence = calcularVencimento(hoje, dias, contagem, calendario);
        prazos = [...prazos, {
            id: novoId(), descricao: `Ação "${acao}" da fase ${fase.nome}`, fase_id: fase.id, acao_idx: i, dias, contagem, inicio: hoje, vence_em: vence,
            status: 'aberto', aberto_em: agora, aberto_por: quem, automatico: true, ...marcasDoPrazo(fase),
        }];
        notas.push(`Prazo da ação "${acao}" aberto: ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'}, vence em ${br(vence)}.`);
    });
    return notas.length ? { prazos, notas } : null;
}

/** A fase atual tem ação com prazo próprio: só então o ato por documento precisa do calendário do órgão. */
export const faseComPrazoDeAcao = (proc: { fases?: unknown; fase_atual?: unknown }): boolean =>
    ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual)?.acoes_regras?.some((r) => Number(r?.prazo_dias) > 0) === true;

/**
 * Quando um cumprimento por documento (juntada, guarda, petição) mexe nos
 * prazos das ações: `campos` traz `prazos` e os derivados, `notas` o que vai ao
 * registro interno. `campos` de entrada: o que o ato já vai gravar (ações
 * feitas); `pendencias`: a lista que o mesmo ato grava, se ele mexe nelas.
 */
export function camposDosPrazosDasAcoes(
    proc: ProcPrazos, campos: Record<string, unknown>, fase: Fase | undefined, quem: string, pendencias?: Pendencia[], calendario?: CalendarioOrgao,
): { campos: Record<string, unknown>; notas: string[] } {
    const pz = prazosDasAcoes({ ...proc, ...campos }, fase, hojeBrasil(), new Date().toISOString(), calendario, quem, () => randomBytes(10).toString('hex'));
    return pz
        ? { campos: { prazos: pz.prazos, ...derivados(pendencias ?? ((proc.pendencias || []) as Pendencia[]), pz.prazos) }, notas: pz.notas }
        : { campos: {}, notas: [] };
}

/**
 * Sair da fase encerra a rodada: o prazo dela é dado por cumprido (como sempre
 * foi), o de ação que ficou por fazer é cancelado, e os das ações deixam de
 * contar para a próxima vez que o processo entrar na fase.
 */
export function encerrarPrazosDaFase(prazos: Prazo[], faseId: string | null, hoje: string, quem: string): { prazos: Prazo[]; notas: string[] } {
    if (!faseId) return { prazos, notas: [] };
    const notas: string[] = [];
    let mudou = false;
    const out = prazos.map((x) => {
        if (!x.fase_id || x.fase_id !== faseId) return x;
        const deAcao = typeof x.acao_idx === 'number';
        if (x.status !== 'aberto') {
            if (!deAcao || x.rodada_fim === true) return x;
            mudou = true;
            return { ...x, rodada_fim: true };
        }
        mudou = true;
        if (deAcao) {
            notas.push(`Prazo encerrado sem cumprimento, com a saída da fase: ${x.descricao}.`);
            return { ...x, status: 'cancelado' as const, encerrado_em: hoje, encerrado_por: quem, rodada_fim: true };
        }
        notas.push(`Prazo interno da fase encerrado ${hoje <= x.vence_em ? 'no prazo' : 'fora do prazo'}: ${x.descricao}.`);
        return { ...x, status: 'cumprido' as const, encerrado_em: hoje, encerrado_por: quem };
    });
    return { prazos: mudou ? out : prazos, notas };
}

const antecedencia = (x: Prazo): number => (typeof x.alerta_dias === 'number' && x.alerta_dias >= 0 ? x.alerta_dias : ALERTA_PADRAO);

/** Prazos abertos que pedem alerta hoje: vencidos ou dentro da antecedência de cada um. Do mais próximo ao mais distante. */
export function prazosEmAlerta(prazos: unknown, hoje: string): Prazo[] {
    return ((Array.isArray(prazos) ? prazos : []) as Prazo[])
        .filter((x) => x.status === 'aberto' && x.vence_em <= somarDias(hoje, antecedencia(x)))
        .sort((a, b) => a.vence_em.localeCompare(b.vence_em));
}

/** Prazos vencidos cuja regra de vencimento (urgência, aviso a quem gere) ainda não foi aplicada. */
export function vencidosATratar(prazos: unknown, hoje: string): Prazo[] {
    return ((Array.isArray(prazos) ? prazos : []) as Prazo[])
        .filter((x) => x.status === 'aberto' && x.vence_em < hoje && !x.vencido_tratado_em && !!x.ao_vencer && typeof x.ao_vencer === 'object'
            && ((x.ao_vencer as { urgente?: unknown }).urgente === true || (x.ao_vencer as { avisar_gestores?: unknown }).avisar_gestores === true));
}
