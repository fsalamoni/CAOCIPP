// Histórico da configuração do Processo Eletrônico: rótulos, assuntos, busca e
// o item que cada evento abre (pelo estado de hoje; o que sumiu não abre).

export const ROTULOS = {
    SECRETARIA_ATIVADA: 'Módulo ativado', SECRETARIA_DESATIVADA: 'Módulo desativado', SECRETARIA_PREFERENCIAS: 'Preferências alteradas',
    SECRETARIA_INTEGRACOES: 'Integrações alteradas', SECRETARIA_SUSPENSA_PLATAFORMA: 'Suspenso pela plataforma', SECRETARIA_REATIVADA_PLATAFORMA: 'Reativado pela plataforma',
    SECRETARIA_ORGAO_SALVO: 'Órgão interno salvo', SECRETARIA_ORGAO_REMOVIDO: 'Órgão interno removido', SECRETARIA_ESTRUTURA_CRIADA: 'Estrutura de órgãos criada',
    SECRETARIA_UNIDADE_SALVA: 'Unidade salva', SECRETARIA_UNIDADE_DOCUMENTO: 'Timbrado ou tipos da unidade', SECRETARIA_UNIDADE_EXCLUIDA: 'Unidade excluída',
    SECRETARIA_EQUIPE_CONVITE: 'Convite à equipe', SECRETARIA_EQUIPE_CONVITE_REVOGADO: 'Convite revogado', SECRETARIA_EQUIPE_CONVITE_ACEITO: 'Convite à equipe aceito',
    SECRETARIA_LOTACAO_ADMITIDA: 'Pedido de lotação admitido', SECRETARIA_LOTACAO_RECUSADA: 'Pedido de lotação recusado',
    SECRETARIA_TIPO_SALVO: 'Tipo de processo salvo', SECRETARIA_TIPO_EXCLUIDO: 'Tipo de processo excluído', SECRETARIA_TIPO_RESTAURADO: 'Tipo de processo restaurado',
    SECRETARIA_NUMERACAO: 'Numeração do órgão alterada',
    SECRETARIA_RITO_SALVO: 'Rito salvo', SECRETARIA_RITO_IMPLANTADO: 'Rito implantado de arquivo', SECRETARIA_RITO_EXCLUIDO: 'Rito excluído', SECRETARIA_RITO_RESTAURADO: 'Rito restaurado',
    SECRETARIA_DOCUMENTO_CONFIG: 'Papel timbrado do órgão', SECRETARIA_MODELO_SALVO: 'Modelo salvo', SECRETARIA_MODELO_EXCLUIDO: 'Modelo excluído',
    SECRETARIA_MODELO_RESTAURADO: 'Modelo restaurado', SECRETARIA_TEXTOS_COMUNICACAO: 'Textos prontos de comunicação',
    SECRETARIA_CALENDARIO: 'Calendário salvo', SECRETARIA_VERSAO_RESTAURADA: 'Versão anterior restaurada',
};

export const rotuloAcao = (a) => ROTULOS[a] || String(a || '').replace('SECRETARIA_', '').replace(/_/g, ' ').toLowerCase();

/** Assuntos do filtro: as abas da configuração e o módulo (ativar, preferências, integrações). */
export const ASSUNTOS = [
    ['unidades', 'Unidades e equipes'], ['estrutura', 'Estrutura'], ['tipos', 'Tipos e numeração'], ['ritos', 'Ritos'],
    ['documentos', 'Documentos e modelos'], ['calendario', 'Calendário'], ['modulo', 'Módulo, preferências e integrações'],
];

const OCULTOS = new Set(['modelo_id', 'rito_id', 'tipo_id', 'unidade_id', 'id', 'convite_id', 'orgao_id', 'uid', 'superior', 'destino', 'sucessora', 'colecao']);

/** Detalhes legíveis do evento (sem ids). */
export function resumoDetalhes(d) {
    return Object.entries(d || {})
        .filter(([k, v]) => !OCULTOS.has(k) && v !== null && v !== undefined && v !== '' && typeof v !== 'object')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v === true ? 'sim' : v === false ? 'não' : v}`)
        .join(' · ');
}

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca sem acento nem caixa no rótulo, em quem fez e nos detalhes. */
export function combina(e, busca) {
    const t = norm(String(busca || '').trim());
    return !t || norm(`${rotuloAcao(e.action)} ${e.user_name || ''} ${resumoDetalhes(e.details)}`).includes(t);
}

/**
 * O item que o evento abre hoje: { aba, id, nome, rotulo } ou null (excluído ou
 * sem item). `rotulo` diz o que o botão de fato abre (aria-label).
 */
export function alvoDoEvento(e, estado) {
    const d = e.details || {};
    const v = e.action === 'SECRETARIA_VERSAO_RESTAURADA' ? d.colecao : null;
    const ritoId = d.rito_id || (v === 'rito' || e.action === 'SECRETARIA_RITO_RESTAURADO' ? d.id : null);
    const tipoId = d.tipo_id || (e.action === 'SECRETARIA_TIPO_RESTAURADO' ? d.id : null);
    const modeloId = d.modelo_id || (v === 'modelo' ? d.id : null);
    const achar = (l, id) => (l || []).find((x) => x.id === id);
    // Rito antes de tipo (implantar traz os dois); modelo antes de unidade (modelo da unidade traz os dois).
    const item = (aba, x) => ({ aba, id: x.id, nome: x.nome, rotulo: `Abrir ${x.nome}` });
    const estrutura = (nome) => ({ aba: 'estrutura', id: null, nome, rotulo: `Ir para Estrutura (${nome})` });
    if (ritoId) { const r = achar(estado?.ritos, ritoId); return r ? item('ritos', r) : null; }
    if (tipoId) { const t = achar(estado?.tipos, tipoId); return t ? item('tipos', t) : null; }
    if (modeloId) {
        const m = achar(estado?.modelos, modeloId);
        if (!m) return null;
        if (m.unidade_id) {
            const un = achar(estado?.unidades, m.unidade_id);
            return un ? { aba: 'unidades', id: un.id, nome: m.nome, rotulo: `Abrir a unidade ${un.nome}, dona do modelo ${m.nome}` } : null;
        }
        return m.orgao_id ? estrutura(m.nome) : item('documentos', m);
    }
    if (d.unidade_id) { const un = achar(estado?.unidades, d.unidade_id); return un ? item('unidades', un) : null; }
    if (d.orgao_id) { const o = achar(estado?.orgaos, d.orgao_id); return o ? estrutura(o.nome) : null; }
    return null;
}
