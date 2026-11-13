/**
 * Levar um processo em andamento para a versão atual do rito (iniciativa do
 * admin). O processo guarda uma cópia das fases com que foi autuado; aqui a
 * cópia é trocada pela atual, e o que já foi feito em cada fase (ações
 * marcadas, respostas, documentos exigidos cumpridos) segue pelo texto da
 * ação e pela descrição do documento, porque a posição pode ter mudado.
 */

interface FaseMin {
    id: string;
    nome?: string;
    acoes?: string[];
    documentos?: Array<{ descricao?: string }>;
}

type PorFase<T> = Record<string, T>;

export interface EstadoProcesso {
    fases?: FaseMin[];
    fase_atual?: string;
    acoes_feitas?: PorFase<number[]>;
    acoes_respostas?: PorFase<Record<string, string>>;
    exigencias_cumpridas?: PorFase<Record<string, unknown>>;
}

/** Posição nova da ação `i` da fase antiga (pelo texto), ou -1. */
function acaoNova(antiga: FaseMin | undefined, nova: FaseMin, i: number): number {
    const t = antiga?.acoes?.[i];
    return typeof t === 'string' && t ? (nova.acoes || []).indexOf(t) : -1;
}

/** Chave nova de exigência cumprida: 'aN' segue a ação, 'dN' segue a descrição do documento. */
function chaveNova(antiga: FaseMin | undefined, nova: FaseMin, chave: string): string | null {
    const m = /^([ad])(\d+)$/.exec(chave);
    if (!m) return null;
    const i = Number(m[2]);
    if (m[1] === 'a') { const j = acaoNova(antiga, nova, i); return j >= 0 ? `a${j}` : null; }
    const d = antiga?.documentos?.[i]?.descricao;
    const j = d ? (nova.documentos || []).findIndex((x) => x.descricao === d) : -1;
    return j >= 0 ? `d${j}` : null;
}

/**
 * Campos a gravar no processo para a versão nova. `faseDestino` é a fase em
 * que o processo fica: a mesma (se existe na versão nova) ou a escolhida pelo
 * admin. Indo para outra fase, ela começa do zero, como ao entrar nela.
 */
export function migrarEstado(proc: EstadoProcesso, novas: FaseMin[], faseDestino: string) {
    const antigas = new Map((proc.fases || []).map((f) => [f.id, f]));
    const novasPorId = new Map(novas.map((f) => [f.id, f]));
    if (!novasPorId.has(faseDestino)) throw new Error('Fase de destino inexistente na versão atual do rito');
    const mudouDeFase = faseDestino !== proc.fase_atual;
    const feitas: PorFase<number[]> = {};
    for (const [fid, lista] of Object.entries(proc.acoes_feitas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !Array.isArray(lista) || (mudouDeFase && fid === faseDestino)) continue;
        const idx = [...new Set(lista.map((i) => acaoNova(antigas.get(fid), nova, i)).filter((i) => i >= 0))].sort((a, b) => a - b);
        if (idx.length) feitas[fid] = idx;
    }
    const respostas: PorFase<Record<string, string>> = {};
    for (const [fid, rs] of Object.entries(proc.acoes_respostas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !rs || typeof rs !== 'object' || (mudouDeFase && fid === faseDestino)) continue;
        const out: Record<string, string> = {};
        // A chave é a ação ('2') ou um campo do formulário dela ('2.sistema'): o campo acompanha a ação.
        for (const [k, v] of Object.entries(rs)) {
            const [i, ...campo] = k.split('.');
            const j = acaoNova(antigas.get(fid), nova, Number(i));
            if (j >= 0) out[[j, ...campo].join('.')] = v;
        }
        if (Object.keys(out).length) respostas[fid] = out;
    }
    const cumpridas: PorFase<Record<string, unknown>> = {};
    for (const [fid, cs] of Object.entries(proc.exigencias_cumpridas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !cs || typeof cs !== 'object' || (mudouDeFase && fid === faseDestino)) continue;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cs)) { const j = chaveNova(antigas.get(fid), nova, k); if (j) out[j] = v; }
        if (Object.keys(out).length) cumpridas[fid] = out;
    }
    return { fases: novas, fase_atual: faseDestino, acoes_feitas: feitas, acoes_respostas: respostas, exigencias_cumpridas: cumpridas, mudou_de_fase: mudouDeFase };
}

/** Grupos da prévia: por versão e fase atual, dizendo se a fase existe na versão nova. */
export function gruposDaMigracao(procs: Array<{ rito_versao?: number; fase_atual?: string; fases?: FaseMin[] }>, novas: FaseMin[]) {
    const ids = new Set(novas.map((f) => f.id));
    const grupos = new Map<string, { versao: number; fase_id: string; fase_nome: string; processos: number; existe: boolean }>();
    for (const p of procs) {
        const versao = Number(p.rito_versao) || 1;
        const fid = String(p.fase_atual || '');
        const k = `${versao}|${fid}`;
        const g = grupos.get(k) || { versao, fase_id: fid, fase_nome: (p.fases || []).find((f) => f.id === fid)?.nome || fid, processos: 0, existe: ids.has(fid) };
        g.processos += 1;
        grupos.set(k, g);
    }
    return [...grupos.values()].sort((a, b) => a.versao - b.versao || a.fase_nome.localeCompare(b.fase_nome));
}
