"use strict";
// ============================================================================
// Folha de dados do processo: a folha do evento 1 (autuação) no PDF dos autos.
// Reúne o que antes ficava na capa (assunto, rito, partes, campos do tipo) e os
// dados que o rito manda trazer para cá (`acoes_regras[i].folha_dados`). É
// montada na impressão, a partir do processo e dos eventos: nada é gravado e a
// cadeia de eventos não muda. Lógica pura, testada em test/folhaDados.test.js.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.situacaoDaCapa = void 0;
exports.secoesDaFolha = secoesDaFolha;
const camposProcesso_1 = require("./camposProcesso");
const informacoes_1 = require("./informacoes");
const secretaria_1 = require("./secretaria");
const SITUACOES = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' };
/** A capa diz só se o processo está ativo ou arquivado. */
const situacaoDaCapa = (status) => (status === 'arquivado' ? 'Arquivado' : status === 'sobrestado' ? 'Ativo (sobrestado)' : 'Ativo');
exports.situacaoDaCapa = situacaoDaCapa;
function secoesDaFolha(d) {
    var _a;
    const p = d.proc; // eslint-disable-line @typescript-eslint/no-explicit-any
    const secoes = [];
    const add = (titulo, itens) => {
        const validos = itens.filter((x) => !!x);
        if (validos.length)
            secoes.push({ titulo, itens: validos });
    };
    const linha = (k, v) => (v === undefined || v === null || v === '' ? null : { texto: `${k}: ${v}` });
    add('Identificação', [
        linha('Assunto', p.assunto),
        linha('Tipo de processo', p.tipo_nome),
        linha('Rito', p.rito_nome ? `${p.rito_nome} (versão ${p.rito_versao})` : ''),
        linha('Sigilo', p.sigilo === 'restrito' ? 'Restrito' : 'Normal'),
        p.urgente === true && linha('Tramitação', `URGENTE${((_a = p.urgencia) === null || _a === void 0 ? void 0 : _a.motivo) ? ` (${p.urgencia.motivo})` : ''}`),
        // A referência da origem é dado interno: só na cópia da equipe.
        d.equipe && p.origem && linha('Origem', (0, secretaria_1.textoOrigem)(p.origem)),
    ]);
    add('Descrição', [p.descricao ? { texto: String(p.descricao) } : null]);
    const partes = (p.partes || []).filter((x) => d.equipe || !x.retirada);
    // CPF/CNPJ só na cópia da equipe: no portal, uma parte não vê o documento da outra.
    add('Partes', partes.map((x) => ({ texto: `${x.polo}: ${x.nome}${d.equipe && x.documento ? ` (${x.documento})` : ''}${x.retirada ? ' (retirada)' : ''}` })));
    // Registro de outro módulo: para as partes, só o número (o título pode não ser delas).
    add('Dados do processo', d.campos.map((c) => ({ texto: `${c.rotulo}: ${c.tipo === 'registro' && !d.equipe ? c.valor : (0, camposProcesso_1.valorTexto)(c)}` })));
    add('Dados registrados no andamento', d.informacoes.flatMap((i) => {
        const linhas = (0, informacoes_1.linhasDaInformacao)(i);
        const nota = d.equipe ? `Fase ${i.fase_nome} · evento ${i.seq} · ${i.por}, ${d.quando(i.em)}` : `Registrado em ${d.quando(i.em)}`;
        return linhas.map((texto, k) => (k === linhas.length - 1 ? { texto, nota } : { texto }));
    }));
    const fase = (p.fases || []).find((f) => f.id === p.fase_atual);
    add(`Situação em ${d.geradoEm}`, [
        linha('Situação', SITUACOES[String(p.status)] || p.status),
        // As partes leem o nome público da fase, como no portal.
        linha('Fase atual', (d.equipe ? fase === null || fase === void 0 ? void 0 : fase.nome : (fase === null || fase === void 0 ? void 0 : fase.nome_publico) || (fase === null || fase === void 0 ? void 0 : fase.nome)) || p.fase_atual),
        linha('Unidade atual', d.unidadeAtual),
    ]);
    return secoes;
}
//# sourceMappingURL=folhaDados.js.map