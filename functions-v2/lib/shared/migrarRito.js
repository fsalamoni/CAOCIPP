"use strict";
/**
 * Levar um processo em andamento para a versão atual do rito (iniciativa do
 * admin). O processo guarda uma cópia das fases com que foi autuado; aqui a
 * cópia é trocada pela atual, e o que já foi feito em cada fase (ações
 * marcadas, respostas, documentos exigidos cumpridos) segue pelo texto da
 * ação e pela descrição do documento, porque a posição pode ter mudado.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrarEstado = migrarEstado;
exports.gruposDaMigracao = gruposDaMigracao;
/** Posição nova da ação `i` da fase antiga (pelo texto), ou -1. */
function acaoNova(antiga, nova, i) {
    var _a;
    const t = (_a = antiga === null || antiga === void 0 ? void 0 : antiga.acoes) === null || _a === void 0 ? void 0 : _a[i];
    return typeof t === 'string' && t ? (nova.acoes || []).indexOf(t) : -1;
}
/** Chave nova de exigência cumprida: 'aN' segue a ação, 'dN' segue a descrição do documento. */
function chaveNova(antiga, nova, chave) {
    var _a, _b;
    const m = /^([ad])(\d+)$/.exec(chave);
    if (!m)
        return null;
    const i = Number(m[2]);
    if (m[1] === 'a') {
        const j = acaoNova(antiga, nova, i);
        return j >= 0 ? `a${j}` : null;
    }
    const d = (_b = (_a = antiga === null || antiga === void 0 ? void 0 : antiga.documentos) === null || _a === void 0 ? void 0 : _a[i]) === null || _b === void 0 ? void 0 : _b.descricao;
    const j = d ? (nova.documentos || []).findIndex((x) => x.descricao === d) : -1;
    return j >= 0 ? `d${j}` : null;
}
/**
 * Campos a gravar no processo para a versão nova. `faseDestino` é a fase em
 * que o processo fica: a mesma (se existe na versão nova) ou a escolhida pelo
 * admin. Indo para outra fase, ela começa do zero, como ao entrar nela.
 */
function migrarEstado(proc, novas, faseDestino) {
    const antigas = new Map((proc.fases || []).map((f) => [f.id, f]));
    const novasPorId = new Map(novas.map((f) => [f.id, f]));
    if (!novasPorId.has(faseDestino))
        throw new Error('Fase de destino inexistente na versão atual do rito');
    const mudouDeFase = faseDestino !== proc.fase_atual;
    const feitas = {};
    for (const [fid, lista] of Object.entries(proc.acoes_feitas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !Array.isArray(lista) || (mudouDeFase && fid === faseDestino))
            continue;
        const idx = [...new Set(lista.map((i) => acaoNova(antigas.get(fid), nova, i)).filter((i) => i >= 0))].sort((a, b) => a - b);
        if (idx.length)
            feitas[fid] = idx;
    }
    const respostas = {};
    for (const [fid, rs] of Object.entries(proc.acoes_respostas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !rs || typeof rs !== 'object' || (mudouDeFase && fid === faseDestino))
            continue;
        const out = {};
        // A chave é a ação ('2') ou um campo do formulário dela ('2.sistema'): o campo acompanha a ação.
        for (const [k, v] of Object.entries(rs)) {
            const [i, ...campo] = k.split('.');
            const j = acaoNova(antigas.get(fid), nova, Number(i));
            if (j >= 0)
                out[[j, ...campo].join('.')] = v;
        }
        if (Object.keys(out).length)
            respostas[fid] = out;
    }
    const cumpridas = {};
    for (const [fid, cs] of Object.entries(proc.exigencias_cumpridas || {})) {
        const nova = novasPorId.get(fid);
        if (!nova || !cs || typeof cs !== 'object' || (mudouDeFase && fid === faseDestino))
            continue;
        const out = {};
        for (const [k, v] of Object.entries(cs)) {
            const j = chaveNova(antigas.get(fid), nova, k);
            if (j)
                out[j] = v;
        }
        if (Object.keys(out).length)
            cumpridas[fid] = out;
    }
    return { fases: novas, fase_atual: faseDestino, acoes_feitas: feitas, acoes_respostas: respostas, exigencias_cumpridas: cumpridas, mudou_de_fase: mudouDeFase };
}
/** Grupos da prévia: por versão e fase atual, dizendo se a fase existe na versão nova. */
function gruposDaMigracao(procs, novas) {
    var _a;
    const ids = new Set(novas.map((f) => f.id));
    const grupos = new Map();
    for (const p of procs) {
        const versao = Number(p.rito_versao) || 1;
        const fid = String(p.fase_atual || '');
        const k = `${versao}|${fid}`;
        const g = grupos.get(k) || { versao, fase_id: fid, fase_nome: ((_a = (p.fases || []).find((f) => f.id === fid)) === null || _a === void 0 ? void 0 : _a.nome) || fid, processos: 0, existe: ids.has(fid) };
        g.processos += 1;
        grupos.set(k, g);
    }
    return [...grupos.values()].sort((a, b) => a.versao - b.versao || a.fase_nome.localeCompare(b.fase_nome));
}
//# sourceMappingURL=migrarRito.js.map