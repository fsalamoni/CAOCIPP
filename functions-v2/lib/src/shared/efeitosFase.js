"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ALERTA_DIAS = exports.ALERTA_PADRAO = exports.MAX_MENSAGEM_AVISO = exports.AVISO_PARA = exports.MAX_PENDENCIA_FASE = exports.DESIGNA = void 0;
exports.sanitizeAoEntrar = sanitizeAoEntrar;
exports.sanitizeAviso = sanitizeAviso;
exports.sanitizePrazosDaFase = sanitizePrazosDaFase;
exports.responsavelPelaFase = responsavelPelaFase;
exports.destinatariosDoAviso = destinatariosDoAviso;
// ============================================================================
// O que a fase faz sozinha, além do prazo e do arquivamento: efeitos ao entrar
// (urgência, sigilo, responsável, pendência ao decisor), quem é avisado e o
// que acontece quando um prazo aberto por ela vence. Tudo opcional: ausente =
// como sempre foi. Lógica pura, testada em test/efeitosFase.test.js; o cliente
// tem o espelho em src/lib/efeitosFase.js (só para a tela; quem decide é o
// servidor).
// ============================================================================
const permissoesFase_1 = require("./permissoesFase");
const texto = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
/** Quem a fase designa como responsável ao entrar: quem moveu o processo, quem gere a unidade ou quem tem certa atribuição na lotação. */
exports.DESIGNA = ['autor', 'gestor', 'atribuicao'];
exports.MAX_PENDENCIA_FASE = 300;
/** Efeitos ao entrar saneados. Lança Error com mensagem para o usuário quando duas escolhas se contradizem. */
function sanitizeAoEntrar(raw, nomeFase) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    const out = {};
    if (o.urgente === true)
        out.urgente = true;
    if (o.sem_urgencia === true)
        out.sem_urgencia = true;
    if (out.urgente && out.sem_urgencia)
        throw new Error(`A fase "${nomeFase}" marca e tira a urgência ao entrar: escolha uma das duas`);
    if (o.sem_responsavel === true)
        out.sem_responsavel = true;
    if (o.arquivar === true)
        out.arquivar = true;
    if (o.sigilo === 'restrito' || o.sigilo === 'normal')
        out.sigilo = o.sigilo;
    if (exports.DESIGNA.includes(o.responsavel)) {
        if (out.sem_responsavel)
            throw new Error(`A fase "${nomeFase}" tira e designa o responsável ao entrar: escolha uma das duas`);
        out.responsavel = o.responsavel;
        if (out.responsavel === 'atribuicao') {
            const a = texto(o.responsavel_atribuicao, permissoesFase_1.MAX_ATRIBUICAO);
            if (!a)
                throw new Error(`A fase "${nomeFase}" designa o responsável pela atribuição: informe a atribuição, como está na lotação (ex.: Promotor)`);
            out.responsavel_atribuicao = a;
        }
    }
    const pendencia = texto(o.pendencia, exports.MAX_PENDENCIA_FASE);
    if (pendencia) {
        out.pendencia = pendencia;
        if (o.pendencia_interrompe === true)
            out.pendencia_interrompe = true;
    }
    // Processo arquivado não tem quem responda por ele nem o que apreciar.
    if (out.arquivar && (out.responsavel || out.pendencia)) {
        throw new Error(`A fase "${nomeFase}" arquiva o processo ao entrar: não cabe designar responsável nem abrir pendência nela`);
    }
    return out;
}
/** A quem a fase avisa quando o processo entra nela. */
exports.AVISO_PARA = ['unidade', 'gestores', 'responsavel', 'ninguem'];
exports.MAX_MENSAGEM_AVISO = 300;
function sanitizeAviso(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    const para = exports.AVISO_PARA.includes(o.para) ? o.para : undefined;
    // Sem aviso, não há mensagem para levar.
    const mensagem = para === 'ninguem' ? '' : texto(o.mensagem, exports.MAX_MENSAGEM_AVISO);
    const out = Object.assign(Object.assign({}, (para ? { para } : {})), (mensagem ? { mensagem } : {}));
    return Object.keys(out).length ? out : undefined;
}
/** Antecedência do alerta diário de prazos quando a fase não diz outra. */
exports.ALERTA_PADRAO = 2;
exports.MAX_ALERTA_DIAS = 30;
/**
 * Regras dos prazos que a fase abre (o dela e os das ações). Só ficam quando a
 * fase abre algum prazo. Antecedência: dias antes do vencimento em que o
 * alerta diário começa (0 = só no dia; ausente = 2).
 */
function sanitizePrazosDaFase(fo, abrePrazo) {
    if (!abrePrazo)
        return {};
    const out = {};
    const bruto = fo.prazo_alerta_dias;
    const n = Number(bruto);
    if (bruto !== undefined && bruto !== null && bruto !== '' && Number.isInteger(n) && n >= 0 && n <= exports.MAX_ALERTA_DIAS && n !== exports.ALERTA_PADRAO)
        out.prazo_alerta_dias = n;
    const v = (fo.prazo_vencido && typeof fo.prazo_vencido === 'object' ? fo.prazo_vencido : {});
    const vencido = Object.assign(Object.assign({}, (v.urgente === true ? { urgente: true } : {})), (v.avisar_gestores === true ? { avisar_gestores: true } : {}));
    if (Object.keys(vencido).length)
        out.prazo_vencido = vencido;
    return out;
}
/**
 * Quem a fase designa ao entrar, entre os lotados na unidade que fica com o
 * processo. `uid` ausente: ninguém foi designado, e a nota diz por quê (vai ao
 * registro interno). Null: a fase não designa.
 */
function responsavelPelaFase(ae, lotacoes, autorUid) {
    if (!(ae === null || ae === void 0 ? void 0 : ae.responsavel))
        return null;
    if (ae.responsavel === 'autor') {
        return lotacoes.some((l) => l.uid === autorUid)
            ? { uid: autorUid, nota: '' }
            : { nota: 'A fase designa como responsável quem moveu o processo, mas essa pessoa não está lotada na unidade que ficou com ele: sem responsável designado.' };
    }
    const quem = ae.responsavel === 'gestor' ? 'quem gere a unidade' : `quem tem a atribuição "${ae.responsavel_atribuicao || ''}"`;
    const candidatos = lotacoes.filter((l) => (ae.responsavel === 'gestor' ? l.gestor : (0, permissoesFase_1.mesmaAtribuicao)(l.atribuicao, ae.responsavel_atribuicao)));
    if (candidatos.length === 1)
        return { uid: candidatos[0].uid, nota: '' };
    return {
        nota: candidatos.length
            ? `A fase designa como responsável ${quem}, e há ${candidatos.length} pessoas assim na unidade: designe pela tela do processo.`
            : `A fase designa como responsável ${quem}, e não há ninguém assim na unidade: sem responsável designado.`,
    };
}
/** Uids avisados da entrada na fase. Sem responsável designado (ou unidade sem gestor), o aviso vai à unidade: não se perde. */
function destinatariosDoAviso(para, lotacoes, responsavelUid) {
    if (para === 'ninguem')
        return [];
    const gestores = lotacoes.filter((l) => l.gestor).map((l) => l.uid);
    if (para === 'gestores' && gestores.length)
        return gestores;
    if (para === 'responsavel' && responsavelUid && lotacoes.some((l) => l.uid === responsavelUid))
        return [responsavelUid];
    return lotacoes.map((l) => l.uid);
}
//# sourceMappingURL=efeitosFase.js.map