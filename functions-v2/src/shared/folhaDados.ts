// ============================================================================
// Folha de dados do processo: a folha do evento 1 (autuação) no PDF dos autos.
// Reúne o que antes ficava na capa (assunto, rito, partes, campos do tipo) e os
// dados que o rito manda trazer para cá (`acoes_regras[i].folha_dados`). É
// montada na impressão, a partir do processo e dos eventos: nada é gravado e a
// cadeia de eventos não muda. Lógica pura, testada em test/folhaDados.test.js.
// ============================================================================

import { CampoValor, valorTexto } from './camposProcesso';
import { InformacaoAndamento, linhasDaInformacao } from './informacoes';
import { textoOrigem } from './secretaria';

export interface ItemFolha { texto: string; nota?: string }
export interface SecaoFolha { titulo: string; itens: ItemFolha[] }

export interface DadosFolha {
    proc: Record<string, unknown>;
    /** Cópia da equipe: traz origem, CPF/CNPJ, partes retiradas e de onde veio cada dado. */
    equipe: boolean;
    /** Campos do processo e informações do andamento, já filtrados para quem lê. */
    campos: CampoValor[];
    informacoes: InformacaoAndamento[];
    unidadeAtual: string;
    geradoEm: string;
    quando: (iso: unknown) => string;
}

const SITUACOES: Record<string, string> = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' };

/** A capa diz só se o processo está ativo ou arquivado. */
export const situacaoDaCapa = (status: unknown): string => (status === 'arquivado' ? 'Arquivado' : status === 'sobrestado' ? 'Ativo (sobrestado)' : 'Ativo');

export function secoesDaFolha(d: DadosFolha): SecaoFolha[] {
    const p = d.proc as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const secoes: SecaoFolha[] = [];
    const add = (titulo: string, itens: Array<ItemFolha | false | null | undefined | ''>) => {
        const validos = itens.filter((x): x is ItemFolha => !!x);
        if (validos.length) secoes.push({ titulo, itens: validos });
    };
    const linha = (k: string, v: unknown): ItemFolha | null => (v === undefined || v === null || v === '' ? null : { texto: `${k}: ${v}` });

    add('Identificação', [
        linha('Assunto', p.assunto),
        linha('Tipo de processo', p.tipo_nome),
        linha('Rito', p.rito_nome ? `${p.rito_nome} (versão ${p.rito_versao})` : ''),
        linha('Sigilo', p.sigilo === 'restrito' ? 'Restrito' : 'Normal'),
        p.urgente === true && linha('Tramitação', `URGENTE${p.urgencia?.motivo ? ` (${p.urgencia.motivo})` : ''}`),
        // A referência da origem é dado interno: só na cópia da equipe.
        d.equipe && p.origem && linha('Origem', textoOrigem(p.origem)),
    ]);
    add('Descrição', [p.descricao ? { texto: String(p.descricao) } : null]);
    const partes = ((p.partes || []) as Array<{ nome: string; polo: string; documento?: string; retirada?: unknown }>).filter((x) => d.equipe || !x.retirada);
    // CPF/CNPJ só na cópia da equipe: no portal, uma parte não vê o documento da outra.
    add('Partes', partes.map((x) => ({ texto: `${x.polo}: ${x.nome}${d.equipe && x.documento ? ` (${x.documento})` : ''}${x.retirada ? ' (retirada)' : ''}` })));
    // Registro de outro módulo: para as partes, só o número (o título pode não ser delas).
    add('Dados do processo', d.campos.map((c) => ({ texto: `${c.rotulo}: ${c.tipo === 'registro' && !d.equipe ? c.valor : valorTexto(c)}` })));
    add('Dados registrados no andamento', d.informacoes.flatMap((i) => {
        const linhas = linhasDaInformacao(i);
        const nota = d.equipe ? `Fase ${i.fase_nome} · evento ${i.seq} · ${i.por}, ${d.quando(i.em)}` : `Registrado em ${d.quando(i.em)}`;
        return linhas.map((texto, k) => (k === linhas.length - 1 ? { texto, nota } : { texto }));
    }));
    const fase = ((p.fases || []) as Array<{ id: string; nome: string; nome_publico?: string }>).find((f) => f.id === p.fase_atual);
    add(`Situação em ${d.geradoEm}`, [
        linha('Situação', SITUACOES[String(p.status)] || p.status),
        // As partes leem o nome público da fase, como no portal.
        linha('Fase atual', (d.equipe ? fase?.nome : fase?.nome_publico || fase?.nome) || p.fase_atual),
        linha('Unidade atual', d.unidadeAtual),
    ]);
    return secoes;
}
