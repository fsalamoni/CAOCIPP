/**
 * Disputa de preços (S11), espelho do que a tela usa de
 * functions-v2/src/shared/certames.ts. Quem decide é o servidor.
 */
export const PERFIS_DISPUTA = { cotacao: 'Cotação privada', dispensa: 'Dispensa eletrônica' };
export const CRITERIOS = { menor_preco: 'Menor preço', maior_desconto: 'Maior desconto' };
export const UNIDADES_DISPUTA = { item: 'Por item', lote: 'Por lote' };
export const RESULTADOS_DISPUTA = ['Homologada', 'Deserta', 'Fracassada'];
export const SITUACOES_CERTAME = { rascunho: 'Em montagem', publicado: 'Recebendo propostas', em_disputa: 'Em disputa', encerrado: 'Encerrado', cancelado: 'Cancelado' };
export const HORAS_LANCES = { cotacao: [1, 10], dispensa: [6, 10] };
export const DIAS_UTEIS_MINIMOS = { cotacao: 1, dispensa: 3 };
export const MAX_ITENS = 200;

/** "1.234,5" ou "1234.5" vira número; vazio vira NaN. */
export const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.trim().replace(/\./g, '').replace(',', '.')) : NaN);
export const moeda = (n) => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '');
export const percentual = (n) => (Number.isFinite(n) ? `${n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%` : '');

/** Lotes da disputa com os itens de cada um (por item: um por item). */
export function unidadesDeDisputa(d) {
    const itens = d?.itens || [];
    if (d?.unidade_disputa !== 'lote') return itens.map((i, k) => ({ chave: i.id || `i${k + 1}`, nome: `Item ${i.numero || k + 1}`, itens: [i] }));
    const lotes = [...new Set(itens.map((i) => Number(i.lote) || 1))].sort((a, b) => a - b);
    return lotes.map((l) => ({ chave: `l${l}`, nome: `Lote ${l}`, itens: itens.filter((i) => (Number(i.lote) || 1) === l) }));
}

/** Soma de quantidade x valor estimado dos itens que têm valor; null sem nenhum. */
export function valorEstimado(itens = []) {
    const com = itens.filter((i) => Number.isFinite(numero(i.valor_estimado)) && Number.isFinite(numero(i.quantidade)));
    return com.length ? com.reduce((s, i) => s + numero(i.quantidade) * numero(i.valor_estimado), 0) : null;
}

/** Valor da proposta na unidade (lote: soma de quantidade x unitário; desconto: média). Null se faltar item. */
export function valorNaUnidade(itensProposta, u, criterio) {
    const vals = u.itens.map((i) => numero(itensProposta.find((x) => x.item_id === i.id)?.valor));
    if (vals.some((v) => !Number.isFinite(v))) return null;
    if (criterio === 'maior_desconto') return vals.reduce((s, v) => s + v, 0) / vals.length;
    return u.itens.reduce((s, i, k) => s + numero(i.quantidade) * vals[k], 0);
}

/** Avisos (não bloqueiam) da proposta enquanto se digita. */
export function alertasDaProposta(itensProposta, aviso) {
    if (aviso?.criterio !== 'menor_preco' || aviso?.orcamento_sigiloso) return [];
    return itensProposta.flatMap((x) => {
        const i = (aviso.itens || []).find((y) => y.id === x.item_id);
        const v = numero(x.valor);
        return i?.valor_estimado && Number.isFinite(v) && v < i.valor_estimado * 0.5 ? [`Item ${i.numero}: o valor está abaixo da metade do estimado`] : [];
    });
}

/** Itens de um lote que ficaram sem valor quando outros do mesmo lote têm (o servidor recusa). */
export function lotesIncompletos(itensProposta, aviso) {
    if (aviso?.unidade_disputa !== 'lote') return [];
    const tem = new Set(itensProposta.filter((x) => Number.isFinite(numero(x.valor))).map((x) => x.item_id));
    return unidadesDeDisputa(aviso).filter((u) => { const n = u.itens.filter((i) => tem.has(i.id)).length; return n && n < u.itens.length; }).map((u) => u.nome);
}

/** "23/11/2026, às 09:00" de um instante ISO (horário de Brasília). */
export function quandoBr(iso) {
    if (!iso) return '';
    const d = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
    return `${d.slice(0, 10).split('-').reverse().join('/')}, às ${d.slice(11, 16)}`;
}

/** Contagem regressiva "hh:mm:ss" (ou "mm:ss" abaixo de uma hora); "00:00" quando acabou. */
export function relogio(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const p = (n) => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    return `${h ? `${p(h)}:` : ''}${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** O valor como o licitante o vê: percentual no maior desconto, moeda nos demais. */
export const valorTexto = (v, criterio) => (criterio === 'maior_desconto' ? percentual(v) : moeda(v));

/**
 * Espelho da conferência do servidor (shared/certames.ts, problemaDoLance), para
 * avisar antes de enviar. O servidor confere de novo.
 */
export function problemaDoLance(valor, atual, d) {
    const desc = d.criterio === 'maior_desconto';
    const r4 = (n) => Math.round(n * 10000) / 10000;
    if (!Number.isFinite(valor) || valor <= 0) return 'Informe o valor do lance';
    if (desc && valor >= 100) return 'O desconto precisa ser menor que 100%';
    const iv = d.intervalo?.valor || 0;
    const passo = desc || d.intervalo?.tipo === 'valor' ? iv : r4((atual * iv) / 100);
    if (desc ? !(valor > atual) : !(valor < atual)) return `O lance precisa ser ${desc ? 'maior' : 'menor'} que o seu último (${valorTexto(atual, d.criterio)})`;
    const limite = r4(desc ? atual + passo : atual - passo);
    if (passo > 0 && (desc ? valor < limite : valor > limite)) return `Respeite o intervalo mínimo entre lances: ${desc ? 'ao menos' : 'no máximo'} ${valorTexto(limite, d.criterio)}`;
    return '';
}

/** Quanto falta até o instante, em texto curto ("2 dias e 3 h", "45 min", "encerrado"). */
export function faltaPara(iso, agora = Date.now()) {
    const ms = Date.parse(iso) - agora;
    if (!(ms > 0)) return 'encerrado';
    const min = Math.floor(ms / 60000);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    if (d) return `${d} dia${d > 1 ? 's' : ''}${h ? ` e ${h} h` : ''}`;
    if (h) return `${h} h${min % 60 ? ` e ${min % 60} min` : ''}`;
    return `${Math.max(1, min)} min`;
}
