// ============================================================================
// Integração do rito com o painel (Consultas, Expedientes, Parcerias ou uma
// página própria). Espelho de functions-v2/src/shared/painelModulos.ts para a
// tela: os nomes das colunas como a equipe vê no quadro, o que cada coluna
// pede e os campos para onde uma ação leva o dado ("Leva ao painel"). Aqui
// também ficam o relatório de cobertura (cada coluna do painel tem uma fase?
// cada informação que o painel pede tem de onde vir?) e as sugestões pelo
// nome, que o admin confere e aplica de uma vez. O servidor confere tudo de
// novo ao salvar o rito. Testado em src/lib/painelModulos.test.js.
// ============================================================================

const TEXTO = ['texto', 'lista'];
const LONGO = ['texto', 'texto_longo', 'lista'];
const DATA = ['data'];

const colunasConsulta = (devolucao) => [
    { id: 'Pendente', rotulo: 'Pendentes', infos: [] },
    { id: 'Em elaboração', rotulo: 'Em Análise', infos: [
        { campo: 'responsible_user_id', rotulo: 'Responsável', auto: 'quem assume o processo na fase (ou quem a fase designa)', obrigatoria: true },
        { campo: 'analysis_start_date', rotulo: 'Início da análise', auto: 'a data em que o registro entra na coluna' },
    ] },
    { id: 'Aguarda retorno de terceiros', rotulo: 'Aguarda Terceiros', infos: [
        { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que o registro entra na coluna', obrigatoria: true },
        { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', obrigatoria: true },
    ] },
    { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
        { campo: 'review_submission_date', rotulo: 'Remessa para revisão', auto: 'a data em que o registro entra na coluna' },
        { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
        { campo: 'observations', rotulo: 'Observações' },
    ] },
    { id: 'Revisadas', rotulo: 'Revisadas', infos: [{ campo: 'reviewed_date', rotulo: 'Data da revisão', auto: 'a data em que o registro entra na coluna', obrigatoria: true }] },
    { id: 'Na pasta', rotulo: 'Arquivados', infos: [
        { campo: 'review_return_date', rotulo: `Devolução ${devolucao}`, auto: 'a data em que o registro entra na coluna, se ainda vazia', obrigatoria: true },
        { campo: 'archived_date', rotulo: 'Arquivamento', auto: 'a data em que o registro entra na coluna' },
    ] },
];

// `chaves`: palavras do nome do dado que sugerem o campo. `fases`: só sugere em fase que põe o registro numa destas colunas.
const camposTramite = [
    { campo: 'entry_date', rotulo: 'Entrada no órgão', tipos: DATA, chaves: ['chegada', 'entrada', 'recebimento'] },
    { campo: 'urgency_request', rotulo: 'Urgência', tipos: ['sim_nao'], chaves: ['urgen'] },
    { campo: 'observations', rotulo: 'Observações', tipos: LONGO, chaves: ['observa'] },
    { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', tipos: TEXTO, chaves: ['destinat', 'terceir', 'remetid'] },
    { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA, coluna: 'Aguarda retorno de terceiros', chaves: ['remessa', 'envio'], fases: ['Aguarda retorno de terceiros'] },
    { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'], chaves: ['pasta', 'rede'] },
    { campo: 'reviewed_date', rotulo: 'Data da revisão', tipos: DATA, coluna: 'Revisadas', chaves: ['revis'], fases: ['Revisadas'] },
    { campo: 'review_return_date', rotulo: 'Data da devolução', tipos: DATA, chaves: ['devolu', 'remessa', 'retorno', 'envio'], fases: ['Revisadas', 'Na pasta'] },
];

export const PAINEIS = {
    consultas: {
        nome: 'Painel de Consultas', registro: 'a consulta', colunas: colunasConsulta('ao consulente'),
        campos: [
            { campo: 'process_number', rotulo: 'Nº da Consulta - PGEA', tipos: ['texto', 'numero'], chaves: ['pgea', 'numero da consulta'] },
            { campo: 'consultant', rotulo: 'Consulente (quem pediu)', tipos: TEXTO, chaves: ['solicitante', 'consulente', 'requerente', 'interessad'] },
            { campo: 'location', rotulo: 'Local', tipos: TEXTO, chaves: ['local', 'municip', 'comarca', 'cidade'] },
            { campo: 'matter_object', rotulo: 'Objeto ou assunto', tipos: LONGO, chaves: ['assunto', 'objeto'] },
            { campo: 'decision', rotulo: 'Decisão ou conclusão', tipos: LONGO, chaves: ['decisao', 'conclusao'] },
            ...camposTramite,
        ],
    },
    expedientes: {
        nome: 'Painel de Expedientes', registro: 'o expediente', colunas: colunasConsulta('à origem'),
        campos: [
            { campo: 'expediente_number', rotulo: 'Nº do Expediente - PGEA', tipos: ['texto', 'numero'], chaves: ['pgea', 'numero do expediente'] },
            { campo: 'system', rotulo: 'Sistema', tipos: TEXTO, chaves: ['sistema'] },
            { campo: 'origin', rotulo: 'Origem', tipos: TEXTO, chaves: ['origem', 'remetente'] },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO, chaves: ['assunto', 'objeto'] },
            ...camposTramite,
        ],
    },
    parcerias: {
        nome: 'Painel de Parcerias', registro: 'a parceria', antes: true,
        colunas: [
            { id: 'Pendente', rotulo: 'Pendentes', infos: [
                { campo: 'pgea', rotulo: 'PGEA', obrigatoria: true }, { campo: 'subject', rotulo: 'Assunto', obrigatoria: true }, { campo: 'parties', rotulo: 'Partes', obrigatoria: true },
            ] },
            { id: 'Em análise', rotulo: 'Em Análise', infos: [
                { campo: 'responsible_user_id', rotulo: 'Assessor responsável', auto: 'quem assume o processo na fase', obrigatoria: true },
                { campo: 'responsibility_date', rotulo: 'Data de responsabilidade', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
            ] },
            { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
                { campo: 'review_start_date', rotulo: 'Início da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
            ] },
            { id: 'Revisadas', rotulo: 'Revisadas', infos: [{ campo: 'reviewed_date', rotulo: 'Conclusão da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true }] },
            { id: 'Aguarda Terceiros', rotulo: 'Aguarda Terceiros', infos: [
                { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                { campo: 'third_party', rotulo: 'Remetido para', obrigatoria: true },
            ] },
            { id: 'Parcerias', rotulo: 'Parcerias', infos: [
                { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', obrigatoria: true },
                { campo: 'partnership_type', rotulo: 'Tipo de parceria', obrigatoria: true },
                { campo: 'signature_date', rotulo: 'Data da assinatura', obrigatoria: true },
                { campo: 'demp', rotulo: 'Publicação no DEMP', obrigatoria: true },
                { campo: 'validity_period', rotulo: 'Vigência', obrigatoria: true },
                { campo: 'object', rotulo: 'Objeto', obrigatoria: true },
                { campo: 'end_date', rotulo: 'Termo final', obrigatoria: true },
                { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', obrigatoria: true },
            ] },
        ],
        campos: [
            { campo: 'pgea', rotulo: 'PGEA', tipos: ['texto', 'numero'], chaves: ['pgea'] },
            { campo: 'subject', rotulo: 'Assunto', tipos: LONGO, chaves: ['assunto'] },
            { campo: 'parties', rotulo: 'Partes', tipos: LONGO, chaves: ['partes', 'partici'] },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO, chaves: ['objeto'] },
            { campo: 'observations', rotulo: 'Observações', tipos: LONGO, chaves: ['observa'] },
            { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'], chaves: ['pasta', 'rede'] },
            { campo: 'third_party', rotulo: 'Remetido para', tipos: TEXTO, chaves: ['destinat', 'terceir', 'remetid'] },
            { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA, chaves: ['remessa a terceir', 'envio a terceir'] },
            { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', tipos: DATA, chaves: ['retorno'] },
            { campo: 'partnership_type', rotulo: 'Tipo de parceria', tipos: TEXTO, chaves: ['tipo de parceria', 'tipo do instrumento', 'especie'] },
            { campo: 'partnership_number', rotulo: 'Número da parceria', tipos: ['texto', 'numero'], chaves: ['numero da parceria', 'numero do termo', 'numero do instrumento'] },
            { campo: 'signature_date', rotulo: 'Data da assinatura', tipos: DATA, chaves: ['assinatura'] },
            { campo: 'demp', rotulo: 'Publicação no DEMP', tipos: TEXTO, chaves: ['demp', 'publicacao'] },
            { campo: 'validity_period', rotulo: 'Vigência', tipos: TEXTO, chaves: ['vigencia'] },
            { campo: 'end_date', rotulo: 'Termo final', tipos: DATA, chaves: ['termo final', 'fim da vigencia', 'final'] },
            { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', tipos: DATA, chaves: ['renovacao'] },
        ],
    },
};
export const MODULOS_PAINEL = ['consultas', 'expedientes', 'parcerias'];

/** Nome da coluna como a equipe vê no quadro (o id é a situação gravada). */
export const rotuloDaColuna = (modulo, id) => PAINEIS[modulo]?.colunas.find((c) => c.id === id)?.rotulo || id;

/** Palavras que sugerem cada coluna pelo nome da fase, na ordem em que se confere. */
const CHAVES_COLUNA = {
    consultas: [
        ['Na pasta', ['arquiv', 'encerr', 'baixa']],
        ['Aguarda retorno de terceiros', ['dilig', 'terceir', 'aguard', 'espera', 'complementa']],
        ['Revisadas', ['devolu', 'resposta ao', 'comunicacao ao', 'ciencia', 'revisad']],
        ['Em revisão', ['revis', 'gabinete', 'aprova', 'validac']],
        ['Em elaboração', ['analis', 'elabora', 'instru', 'estudo', 'minuta', 'parecer', 'assessor']],
        ['Pendente', ['receb', 'protocol', 'triagem', 'autua', 'distribu']],
    ],
    parcerias: [
        ['Parcerias', ['formaliza', 'celebra', 'vigencia', 'publica']],
        ['Aguarda Terceiros', ['dilig', 'terceir', 'aguard', 'espera']],
        ['Revisadas', ['revisad', 'aprovad']],
        ['Em revisão', ['revis', 'gabinete', 'aprova']],
        ['Em análise', ['analis', 'elabora', 'instru', 'estudo', 'parecer']],
        ['Pendente', ['receb', 'protocol', 'triagem', 'autua']],
    ],
};
CHAVES_COLUNA.expedientes = CHAVES_COLUNA.consultas;

export const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tem = (texto, chaves) => chaves.some((c) => sem(texto).includes(c));

/**
 * O painel escolhido, no mesmo formato para os três módulos e para uma página
 * própria. `alvo`: { modulo, pagina? }; `paginas`: as do órgão
 * ([{ id, nome, plural, fases: [{ key, label }], campos: [{ key, label, type, phase, required, required_to_advance }] }]).
 */
export function painelDe(alvo, paginas) {
    if (alvo?.modulo !== 'paginas') return PAINEIS[alvo?.modulo] || null;
    const pg = (paginas || []).find((p) => p.id === alvo.pagina);
    if (!pg) return null;
    const tiposDe = (t) => (t === 'number' || t === 'currency' ? ['numero', 'texto'] : t === 'date' ? DATA : t === 'boolean' ? ['sim_nao'] : t === 'textarea' ? LONGO
        : t === 'select' || t === 'multiselect' || t === 'city' ? ['lista', 'texto'] : ['texto', 'lista', 'numero']);
    const campos = (pg.campos || []).filter((c) => c.type !== 'user_ref');
    return {
        nome: pg.plural || pg.nome, registro: `o registro de ${pg.nome}`, pagina: true,
        colunas: (pg.fases || []).map((f) => ({
            id: f.key, rotulo: f.label,
            infos: campos.filter((c) => c.phase === f.key).map((c) => ({ campo: c.key, rotulo: c.label, ...(c.required || c.required_to_advance ? { obrigatoria: true } : {}) })),
        })),
        campos: campos.map((c) => ({ campo: c.key, rotulo: c.label, tipos: tiposDe(c.type), chaves: [sem(c.label)].filter((x) => x.length >= 3) })),
    };
}

/** Os dados que as ações do rito registram: [{ fase, idx, campoForm?, rotulo, tipo }]. */
function dadosDoRito(fases) {
    const out = [];
    for (const f of fases || []) {
        (f.acoes || []).forEach((a, i) => {
            const r = f.acoes_regras?.[i];
            if (!r || r.documento || r.ve || !a?.trim()) return;
            if (r.pede === 'formulario') {
                for (const c of r.campos || []) out.push({ fase: f, idx: i, acao: a.trim(), campoForm: c.id, rotulo: c.rotulo || c.id, tipo: c.tipo });
            } else if (['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'].includes(r.pede)) {
                out.push({ fase: f, idx: i, acao: a.trim(), rotulo: r.rotulo || a.trim(), tipo: r.pede });
            }
        });
    }
    return out;
}

const mesmoAlvo = (s, alvo) => s?.modulo === alvo.modulo && (alvo.modulo !== 'paginas' || s.pagina === alvo.pagina);
/** Para onde o dado vai hoje (a ligação gravada na ação). */
const destinoAtual = (d, alvo) => {
    const ao = d.fase.acoes_regras?.[d.idx]?.ao_registro;
    if (!mesmoAlvo(ao, alvo)) return null;
    return d.campoForm ? ao.campos?.[d.campoForm] || null : ao.campo || null;
};
/** As colunas em que a fase põe o registro. */
const colunasDaFase = (f, alvo) => (mesmoAlvo(f.situacao_registro, alvo) ? [f.situacao_registro.ao_entrar, f.situacao_registro.ao_assumir].filter(Boolean) : []);

/**
 * Cobertura do painel pelo rito: para cada coluna, as fases que põem o
 * registro nela e, para cada informação que ela pede, de onde vem (o sistema
 * preenche, uma ação leva, ou falta). Também as fases que não mexem no
 * registro e as que conduzem outro painel.
 */
export function relatorioIntegracao(fases, alvo, paginas) {
    const painel = painelDe(alvo, paginas);
    if (!painel) return null;
    const dados = dadosDoRito(fases);
    const colunas = painel.colunas.map((col, ci) => {
        const fs = (fases || []).filter((f) => colunasDaFase(f, alvo).includes(col.id)).map((f) => ({ id: f.id, nome: f.nome, ao_assumir: f.situacao_registro.ao_assumir === col.id }));
        const infos = col.infos.map((info) => {
            if (info.auto) return { ...info, estado: 'auto' };
            const d = dados.find((x) => destinoAtual(x, alvo) === info.campo);
            return d ? { ...info, estado: 'acao', fonte: { fase: d.fase.id, faseNome: d.fase.nome, acao: d.acao, dado: d.rotulo } } : { ...info, estado: info.obrigatoria ? 'falta' : 'opcional' };
        });
        // A coluna inicial do painel vale sem fase: o registro já nasce nela.
        const coberta = fs.length > 0 || ci === 0;
        return { ...col, fases: fs, infos, coberta, inicial: ci === 0 && !fs.length };
    });
    const levados = dados.filter((d) => destinoAtual(d, alvo)).map((d) => ({ fase: d.fase.id, faseNome: d.fase.nome, acao: d.acao, dado: d.rotulo, campo: destinoAtual(d, alvo), campoNome: painel.campos.find((c) => c.campo === destinoAtual(d, alvo))?.rotulo || destinoAtual(d, alvo) }));
    const semColuna = (fases || []).filter((f) => !f.situacao_registro?.modulo).map((f) => f.nome);
    const outroPainel = (fases || []).filter((f) => f.situacao_registro?.modulo && !mesmoAlvo(f.situacao_registro, alvo)).map((f) => f.nome);
    const faltas = [
        ...colunas.filter((c) => !c.coberta).map((c) => `Nenhuma fase põe ${painel.registro} em "${c.rotulo}".`),
        ...colunas.flatMap((c) => (c.coberta ? c.infos.filter((i) => i.estado === 'falta').map((i) => `"${i.rotulo}", que o painel pede em "${c.rotulo}", não vem de nenhuma ação.`) : [])),
    ];
    return { painel, colunas, levados, semColuna, outroPainel, faltas, pronto: !faltas.length };
}

/** A coluna que o nome (ou o jeito) da fase sugere. */
export function colunaSugerida(f, alvo, painel) {
    if (alvo.modulo === 'paginas') {
        const n = sem(f.nome).replace(/[^a-z0-9 ]/g, '').trim();
        const achada = painel.colunas.find((c) => { const k = sem(c.rotulo).replace(/[^a-z0-9 ]/g, '').trim(); return k && n && (k === n || (k.length >= 4 && n.includes(k)) || (n.length >= 4 && k.includes(n))); });
        return achada?.id || null;
    }
    const ids = painel.colunas.map((c) => c.id);
    if (f.final && ids.includes('Na pasta')) return 'Na pasta';
    if (f.espera) return ids.find((x) => /^Aguarda/.test(x)) || null;
    return CHAVES_COLUNA[alvo.modulo].find(([, ch]) => tem(f.nome, ch))?.[0] || null;
}

/** A regra da fase para a coluna: na análise, Pendente até alguém assumir. */
const regraDaColuna = (alvo, col) => ({
    modulo: alvo.modulo, ...(alvo.pagina ? { pagina: alvo.pagina } : {}),
    ...(alvo.modulo !== 'paginas' && ['Em elaboração', 'Em análise'].includes(col) ? { ao_entrar: 'Pendente', ao_assumir: col } : { ao_entrar: col }),
});

/** Nome curto de um painel numa frase ("a consulta", "o registro de Contratos"). */
const nomeCol = (painel, id) => painel.colunas.find((c) => c.id === id)?.rotulo || id;

/**
 * Sugestões para integrar o rito ao painel, para o admin conferir:
 * - `coluna`: a fase (que ainda não mexe no registro) põe o registro na
 *   coluna que o nome dela sugere;
 * - `levar`: o dado de uma ação (ou campo de formulário dela) vai para o
 *   campo do registro que o nome sugere, do mesmo tipo;
 * - `criar`: a coluna pede uma informação que nenhuma ação dá: a fase ganha
 *   a ação que pede o dado e o leva ao painel.
 * [{ chave, tipo, fase, texto, ... }].
 */
export function sugestoesDeIntegracao(fases, alvo, paginas) {
    const painel = painelDe(alvo, paginas);
    if (!painel) return [];
    const out = [];
    // 1. Colunas: só fase sem regra (a que já conduz algo fica como está).
    const colunaDe = new Map();
    for (const f of fases || []) {
        if (f.situacao_registro?.modulo) { if (mesmoAlvo(f.situacao_registro, alvo)) colunaDe.set(f.id, colunasDaFase(f, alvo)); continue; }
        const col = colunaSugerida(f, alvo, painel);
        // A primeira fase não precisa pôr o registro na coluna inicial: ele já nasce nela.
        if (!col || (f === fases[0] && col === painel.colunas[0]?.id)) continue;
        const regra = regraDaColuna(alvo, col);
        colunaDe.set(f.id, [regra.ao_entrar, regra.ao_assumir].filter(Boolean));
        out.push({
            chave: `col:${f.id}`, tipo: 'coluna', fase: f.id, regra,
            texto: regra.ao_assumir ? `"${f.nome}" deixa ${painel.registro} em "${nomeCol(painel, regra.ao_entrar)}" e passa para "${nomeCol(painel, regra.ao_assumir)}" quando alguém assume` : `"${f.nome}" põe ${painel.registro} em "${nomeCol(painel, col)}"`,
        });
    }
    // 2. Dados: cada campo do registro recebe de uma ação só; cada dado vai a um campo só.
    const dados = dadosDoRito(fases);
    const usadosCampo = new Set(dados.map((d) => destinoAtual(d, alvo)).filter(Boolean));
    const usadosDado = new Set(dados.filter((d) => d.fase.acoes_regras?.[d.idx]?.ao_registro).map((d) => `${d.fase.id}:${d.idx}:${d.campoForm || ''}`));
    for (const c of painel.campos) {
        if (usadosCampo.has(c.campo) || !c.chaves?.length) continue;
        const d = dados.find((x) => !usadosDado.has(`${x.fase.id}:${x.idx}:${x.campoForm || ''}`) && c.tipos.includes(x.tipo) && tem(x.rotulo, c.chaves)
            && (!c.fases || (colunaDe.get(x.fase.id) || []).some((k) => c.fases.includes(k))));
        if (!d) continue;
        usadosCampo.add(c.campo);
        usadosDado.add(`${d.fase.id}:${d.idx}:${d.campoForm || ''}`);
        out.push({
            chave: `lev:${d.fase.id}:${d.idx}:${d.campoForm || ''}`, tipo: 'levar', fase: d.fase.id, idx: d.idx, campoForm: d.campoForm, campo: c.campo,
            texto: `"${d.rotulo}"${d.campoForm ? `, em "${d.acao}",` : ''} vai para "${c.rotulo}" no painel`,
        });
    }
    // 3. O que o painel exige e nenhuma ação dá: cria a ação na fase que põe o registro na coluna (em Parcerias, na fase anterior).
    for (const col of painel.colunas) {
        for (const info of col.infos) {
            if (info.auto || !info.obrigatoria || usadosCampo.has(info.campo)) continue;
            const def = painel.campos.find((c) => c.campo === info.campo);
            const naColuna = (fases || []).find((f) => (colunaDe.get(f.id) || []).includes(col.id));
            const fase = !naColuna ? null : painel.antes ? (fases || []).find((f) => (f.proximas || []).includes(naColuna.id)) : naColuna;
            if (!def || !fase || (fase.acoes || []).length >= 20) continue;
            usadosCampo.add(info.campo);
            out.push({
                chave: `cri:${fase.id}:${info.campo}`, tipo: 'criar', fase: fase.id, campo: info.campo, acao: `Informar: ${info.rotulo}`, pede: def.tipos[0],
                texto: `"${fase.nome}" ganha a ação "Informar: ${info.rotulo}", obrigatória, que leva o dado ao painel (pedido em "${col.rotulo}")`,
            });
        }
    }
    return out;
}

/** Fases com as sugestões escolhidas aplicadas (cópias; nada muda sem salvar o rito). */
export function aplicarIntegracao(fases, sugestoes, alvo) {
    const base = { modulo: alvo.modulo, ...(alvo.pagina ? { pagina: alvo.pagina } : {}) };
    return (fases || []).map((f) => {
        const daFase = sugestoes.filter((s) => s.fase === f.id);
        if (!daFase.length) return f;
        let n = { ...f, acoes: [...(f.acoes || [])], acoes_regras: (f.acoes || []).map((_a, i) => (f.acoes_regras?.[i] ? { ...f.acoes_regras[i] } : null)) };
        for (const s of daFase) {
            if (s.tipo === 'coluna') n = { ...n, situacao_registro: s.regra };
            else if (s.tipo === 'levar') {
                const r = n.acoes_regras[s.idx] || {};
                const ao = mesmoAlvo(r.ao_registro, alvo) ? { ...r.ao_registro } : { ...base };
                if (s.campoForm) { ao.campos = { ...(ao.campos || {}), [s.campoForm]: s.campo }; delete ao.campo; } else ao.campo = s.campo;
                n.acoes_regras[s.idx] = { ...r, ao_registro: ao };
            } else if (s.tipo === 'criar') {
                n.acoes.push(s.acao);
                n.acoes_regras.push({ pede: s.pede, obrigatoria: true, destino: 'informacao', ao_registro: { ...base, campo: s.campo } });
            }
        }
        if (!n.acoes.length) { delete n.acoes; delete n.acoes_regras; }
        return n;
    });
}

/** Campos para onde a ação pode levar o dado, pelo tipo: [[campo, rótulo]]. */
export function camposParaLevar(alvo, tipo, paginas) {
    const painel = painelDe(alvo, paginas);
    return (painel?.campos || []).filter((c) => c.tipos.includes(tipo)).map((c) => [c.campo, c.rotulo]);
}

/** Painéis que o órgão pode escolher: [[valor, rótulo]] (`paginas:<id>` para página própria). */
export function paineisDisponiveis(ligadas, paginas) {
    return [
        ...MODULOS_PAINEL.filter((m) => ligadas?.[m]).map((m) => [m, PAINEIS[m].nome]),
        ...(ligadas?.paginas ? (paginas || []).map((p) => [`paginas:${p.id}`, `Página ${p.plural || p.nome}`]) : []),
    ];
}
export const alvoDe = (valor) => (String(valor).startsWith('paginas:') ? { modulo: 'paginas', pagina: String(valor).slice(8) } : { modulo: valor });
export const valorDoAlvo = (alvo) => (alvo?.modulo === 'paginas' ? `paginas:${alvo.pagina}` : alvo?.modulo || '');

/** O painel que o rito já conduz (o da primeira fase com regra), para abrir a integração nele. */
export function alvoDoRito(fases) {
    const s = (fases || []).map((f) => f.situacao_registro || (f.acoes_regras || []).find((r) => r?.ao_registro)?.ao_registro).find((x) => x?.modulo);
    return s ? { modulo: s.modulo, ...(s.pagina ? { pagina: s.pagina } : {}) } : null;
}

// ---------------------------------------------------------------------------
// Gerar o painel e a planilha do rito: uma página própria com uma coluna por
// fase e um campo por dado que as ações pedem. A página é gravada pelo
// upsertEntityType (que valida tudo no servidor) e o rito passa a conduzi-la.
// ---------------------------------------------------------------------------

const semAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Chave de campo ou de fase: minúsculas, números e _ (começa por letra), até 40, sem repetir. */
function chaveUnica(nome, usadas, prefixo) {
    let base = semAcentos(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34) || prefixo;
    if (!/^[a-z]/.test(base)) base = `${prefixo}_${base}`.slice(0, 34);
    let k = base;
    for (let n = 2; usadas.has(k); n += 1) k = `${base}_${n}`;
    usadas.add(k);
    return k;
}
const opcoesDe = (lista) => [...new Set((lista || []).map((o) => String(o).trim()).filter(Boolean))].map((o) => ({ value: o, label: o }));
/** Tipo do campo da página para o que a ação pede. */
function tipoDoCampo(tipo, opcoes) {
    if (tipo === 'data') return { type: 'date' };
    if (tipo === 'numero') return { type: 'number' };
    if (tipo === 'sim_nao') return { type: 'boolean' };
    if (tipo === 'texto_longo') return { type: 'textarea' };
    if (tipo === 'lista') return opcoesDe(opcoes).length ? { type: 'select', options: opcoesDe(opcoes) } : { type: 'text' };
    return { type: 'text' };
}

/**
 * O painel que o rito gera. `nome`: [singular, plural]. Devolve a definição
 * da página (`def`) e onde cada fase e cada dado do rito foram parar, para
 * `ligarAoPainelGerado`. Fase que já conduz outro painel entra como coluna,
 * mas não é religada (uma fase conduz um painel só).
 */
export function painelDoRito(fases, [singular, plural]) {
    const lista = (fases || []).filter((f) => f?.nome?.trim());
    const chavesFase = new Set();
    const colunas = lista.map((f, i) => ({ fase: f.id, key: chaveUnica(f.nome, chavesFase, 'fase'), label: f.nome.trim().slice(0, 60), order: i }));
    const faseKey = Object.fromEntries(colunas.map((c) => [c.fase, c.key]));
    const chavesCampo = new Set(['processo', 'assunto']);
    const campos = [
        { key: 'processo', label: 'Processo eletrônico', type: 'text', table: { show: true, order: 0 } },
        { key: 'assunto', label: 'Assunto', type: 'textarea', table: { show: true, order: 1 } },
    ];
    const dados = [];
    for (const d of dadosDoRito(lista)) {
        const r = d.fase.acoes_regras?.[d.idx];
        if (r?.ao_registro) continue; // já leva a outro painel
        const opcoes = d.campoForm ? (r.campos || []).find((c) => c.id === d.campoForm)?.opcoes : r.opcoes;
        const key = chaveUnica(d.rotulo, chavesCampo, 'campo');
        campos.push({ key, label: String(d.rotulo).slice(0, 80), ...tipoDoCampo(d.tipo, opcoes), phase: faseKey[d.fase.id], table: { show: campos.length < 8, order: campos.length } });
        dados.push({ fase: d.fase.id, idx: d.idx, campoForm: d.campoForm, key });
    }
    const def = {
        label_singular: singular.trim().slice(0, 60), label_plural: plural.trim().slice(0, 60), enabled: true,
        fields: campos,
        phases: colunas.map((c, i) => ({ key: c.key, label: c.label, order: c.order, ...(i === 0 ? { is_initial: true } : {}), ...(lista[i].final ? { is_final: true } : {}) })),
        table_layout: { columns: campos.filter((c) => c.table.show).map((c) => ({ field_key: c.key, order: c.table.order })) },
    };
    return { def, colunas, dados };
}

/** As fases do rito ligadas à página gerada (`pagina`: o id que o servidor devolveu). */
export function ligarAoPainelGerado(fases, gerado, pagina) {
    const coluna = Object.fromEntries(gerado.colunas.map((c) => [c.fase, c.key]));
    const primeira = gerado.colunas[0]?.fase;
    return fases.map((f) => {
        const dados = gerado.dados.filter((d) => d.fase === f.id);
        const livre = !f.situacao_registro?.modulo;
        if (!coluna[f.id] || (!livre && !dados.length)) return f;
        const regras = [...(f.acoes_regras || [])];
        for (const d of dados) {
            const r = regras[d.idx] || {};
            const ao = d.campoForm
                ? { modulo: 'paginas', pagina, campos: { ...(r.ao_registro?.pagina === pagina ? r.ao_registro.campos : {}), [d.campoForm]: d.key } }
                : { modulo: 'paginas', pagina, campo: d.key };
            regras[d.idx] = { ...r, ao_registro: ao };
        }
        return {
            ...f,
            ...(dados.length ? { acoes_regras: regras } : {}),
            ...(livre ? { situacao_registro: { modulo: 'paginas', pagina, ao_entrar: coluna[f.id], ...(f.id === primeira ? { na_autuacao: true } : {}) } } : {}),
        };
    });
}
