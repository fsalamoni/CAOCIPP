"use strict";
/**
 * "Meus Processos Eletrônicos": o que a parte (ou representante) precisa
 * fazer em cada processo, dito em uma frase. Leitura estruturada, sem IA.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.situacaoDaParte = situacaoDaParte;
const br = (iso) => iso.split('-').reverse().join('/');
function situacaoDaParte(e, hoje) {
    const prazos = [...e.prazos].sort((a, b) => a.vence_em.localeCompare(b.vence_em));
    const vencido = prazos.find((p) => p.vence_em < hoje);
    if (vencido) {
        return { situacao: 'vencido', prioridade: 0, data: vencido.vence_em, frase: `Prazo vencido em ${br(vencido.vence_em)}: ${vencido.descricao}. Manifeste-se o quanto antes.` };
    }
    // A ciência vem antes do prazo já aberto: enquanto não é dada, o decurso corre.
    const c = [...e.aguardando].sort((a, b) => String(a.limite_ciencia || '9').localeCompare(String(b.limite_ciencia || '9')))[0];
    if (c && !prazos.length) {
        return {
            situacao: 'ciencia', prioridade: 1, data: c.limite_ciencia,
            frase: `Dê ciência da ${c.especie_nome.toLowerCase()}${c.prazo ? `: abre prazo de ${c.prazo}` : ''}${c.limite_ciencia ? ` (vale por decurso em ${br(c.limite_ciencia)})` : ''}.`,
        };
    }
    if (prazos.length) {
        const p = prazos[0];
        return {
            situacao: 'prazo', prioridade: 2, data: p.vence_em,
            frase: `${p.vence_em === hoje ? 'Prazo vence hoje' : `Prazo até ${br(p.vence_em)}`}: ${p.descricao}.${c ? ` Há também ${c.especie_nome.toLowerCase()} aguardando a sua ciência.` : ''}`,
        };
    }
    if (e.status === 'arquivado')
        return { situacao: 'encerrado', prioridade: 5, data: null, frase: 'Processo arquivado. Nada a fazer.' };
    if (e.peticoes > 0) {
        return { situacao: 'apreciacao', prioridade: 3, data: null, frase: `Aguarde: ${e.peticoes === 1 ? 'sua manifestação está' : `${e.peticoes} manifestações suas estão`} para apreciação.` };
    }
    return { situacao: 'acompanhar', prioridade: 4, data: null, frase: e.status === 'sobrestado' ? 'Processo sobrestado. Nada a fazer por ora.' : 'Nada a fazer agora. Acompanhe os andamentos.' };
}
//# sourceMappingURL=meusProcessos.js.map