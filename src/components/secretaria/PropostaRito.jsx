import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertTriangle, ArrowDown, ArrowUp, Building2, CheckCircle2, ChevronDown, ChevronsDown, ChevronsUp, Copy, CopyPlus, Download, FilePlus2, FileSpreadsheet, FileText, FileUp, GitBranch,
    LayoutTemplate, ListPlus, Loader2, MoreVertical, Plus, Redo2, Rocket, Save, Shapes, Trash2, Undo2, Users, X,
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { arquivoParaBase64, secConfig } from '@/services/secretariaService';
import { deRito, montarPayload, propostaDeAbas, propostaDeConteudo, propostaDeDiagramas, propostaDeTexto, sem, tipoDocumentoDe, vincularProposta } from '@/lib/propostaRito';
import { copiarFases, ehEspera, modelosDeRito, novoIdFase, origensDaEspera, problemasDoFluxo, ritoParaMermaid, ritoParaTabela } from '@/lib/secretariaRito';
import { MAX_CAMPOS_ACAO, problemaDaCondicao, registroComOutros, textoCondicao, tirarDoGrupo } from '@/lib/exigencias';
import { MODULOS, integracoesLigadas, problemasFormulario } from '@/lib/camposProcesso';
import { ItemOrdenavel, ListaOrdenavel } from './Ordenavel';
import FluxoRito from './FluxoRito';
import { AcoesDaFase, CondicaoPorResposta, RegistroEDocumentos } from './RegrasDaFase';
import { TIPOS_UNIDADE, copiarTexto } from './comum';
import { BloqueioRito } from './Lixeira';
import PreviaRito from './PreviaRito';
import GuiaRito from './GuiaRito';
import AndamentoDaFase from './AndamentoDaFase';
import { nomeDoModuloDaRegra, problemaDaPagina, resumoAndamento } from '@/lib/andamentoFase';
import { RegistroContexto } from './SeletorRegistro';

const MAX_MB = 5;
const MAX_FASES = 60; // igual ao servidor (MAX_FASES em functions-v2/src/shared/secretaria.ts)
const MAX_MODELOS_FASE = 10; // igual ao servidor
const MAX_DESFAZER = 30;
// Botões de ícone: 44px no toque, compactos a partir do tablet.
const ICONE = 'h-11 w-11 sm:h-8 sm:w-8';
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const mudarDeLugar = (lista, de, para) => { const l = [...lista]; const [x] = l.splice(de, 1); l.splice(para, 0, x); return l; };
const ehCampoDeTexto = (el) => el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName);
const ACEITOS = '.xlsx,.xlsm,.xls,.csv,.ods,.docx,.pdf,.txt,.md,.bpm,.bpmn,.xpdl,.xml,.drawio,.mmd';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_BIZAGI = 'application/x-bizagi-bpm';
const campo = 'h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
// Rascunho por rito: o de um rito novo e o de cada rito em edição não se misturam.
const chaveRascunho = (orgId, id) => (id ? `rito-rascunho-${orgId}-${id}` : `rito-rascunho-${orgId}`);
const lerRascunho = (orgId, id) => { try { return JSON.parse(localStorage.getItem(chaveRascunho(orgId, id)) || 'null'); } catch { return null; } };
const apagarRascunho = (orgId, id) => { try { localStorage.removeItem(chaveRascunho(orgId, id)); } catch { /* ignora */ } };

export async function baixarPlanilha(fases, nome) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ritoParaTabela(fases));
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 32 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Rito');
    XLSX.writeFile(wb, `${(nome || 'rito').replace(/[^\w\- ]+/g, '').trim() || 'rito'}.xlsx`);
}

/**
 * Pendências que travam ou enfraquecem a implantação, com a fase para ir até ela.
 * `ligadas`: integrações com outros módulos (sem ela, não se confere a ação "registro").
 * `paginas`: páginas próprias do órgão, para conferir a que a fase conduz (`null`: ainda não se sabe).
 */
export function pendenciasDaProposta(p, ligadas = null, paginas = null) {
    const out = [];
    const ids = new Set(p.fases.map((f) => f.id));
    const fluxo = problemasDoFluxo(p.fases);
    const soltas = new Set(fluxo.soltas);
    const presas = new Set(fluxo.presas);
    if (!p.fases.length) out.push({ fase: null, grave: true, texto: 'O rito precisa de ao menos uma fase.' });
    if (p.fases.length > MAX_FASES) out.push({ fase: p.fases[MAX_FASES].id, grave: true, texto: `O rito tem ${p.fases.length} fases; o máximo é ${MAX_FASES}. Junte ou remova fases (os detalhes podem virar ações de uma fase).` });
    p.fases.forEach((f, i) => {
        const rot = f.nome.trim() || `Fase ${i + 1}`;
        if (!f.nome.trim()) out.push({ fase: f.id, grave: true, texto: `${rot} está sem nome.` });
        (f.acoes || []).forEach((a, k) => {
            const r = f.acoes_regras?.[k];
            if (a.trim() && r?.pede === 'lista' && (r.opcoes || []).filter((o) => o.trim()).length < 2) {
                out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a ação "${a.trim()}" pede uma escolha: informe ao menos duas opções.` });
            }
            const prob = a.trim() && r?.se ? problemaDaCondicao(f, r.se, k) || (r.se.valores.length ? null : 'está sem resposta marcada') : null;
            if (prob) out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a condição de "${a.trim()}" ${prob}. Ajuste em "Quando vale".` });
            if (a.trim() && r?.pede === 'formulario') {
                const campos = r.campos || [];
                if (!campos.length) out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a ação "${a.trim()}" pede um formulário: crie ao menos um campo.` });
                if (campos.length > MAX_CAMPOS_ACAO) out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a ação "${a.trim()}" tem ${campos.length} campos; cabem ${MAX_CAMPOS_ACAO}.` });
                problemasFormulario({ campos }).forEach((x) => out.push({ fase: f.id, grave: true, texto: `Em ${rot}, no formulário de "${a.trim()}": ${x}.` }));
                campos.filter((c) => c.tipo === 'registro' && ligadas && !ligadas[c.modulo]).forEach((c) => out.push({ fase: f.id, grave: true,
                    texto: `Em ${rot}, o campo "${c.rotulo.trim() || 'sem nome'}" da ação "${a.trim()}" pede um registro de ${MODULOS.find(([m]) => m === c.modulo)?.[1] || c.modulo}, mas essa integração está desligada.` }));
            }
            if (a.trim() && r?.pede === 'registro' && ligadas && !ligadas[r.modulo]) {
                const mod = MODULOS.find(([m]) => m === r.modulo)?.[1] || r.modulo;
                out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a ação "${a.trim()}" pede um registro de ${mod}, mas essa integração está desligada: ligue em "Integrações com outros módulos" ou mude o que a ação pede.` });
            }
        });
        const sit = f.situacao_registro;
        if (sit?.modulo && ligadas && !ligadas[sit.modulo]) {
            out.push({ fase: f.id, grave: true, texto: `${rot} muda a situação em ${nomeDoModuloDaRegra(sit, paginas)}, mas essa integração está desligada: ligue em "Integrações com outros módulos" ou tire a regra em "Andamento automático".` });
        } else if (problemaDaPagina(sit, paginas)) {
            out.push({ fase: f.id, grave: true, texto: `${rot} ${problemaDaPagina(sit, paginas)}: ajuste em "Andamento automático".` });
        }
        if (sit?.modulo && !sit.ao_entrar && !sit.ao_assumir) out.push({ fase: f.id, texto: `${rot} escolheu um registro para conduzir, mas não disse a situação: a regra é descartada ao salvar.` });
        // Segue sozinha ao cumprir o último item obrigatório: ação obrigatória ou documento exigido (da fase ou de uma ação).
        const exige = (f.acoes_regras || []).some((r, k) => (f.acoes || [])[k]?.trim() && (r?.obrigatoria || (r?.documento && !r.documento.nivel)))
            || (f.documentos || []).some((d) => (d.descricao || '').trim() && !d.nivel);
        if (f.avanco === 'auto' && !f.final && !exige) {
            out.push({ fase: f.id, texto: `${rot} segue sozinha, mas não exige nada (ação obrigatória ou documento obrigatório): ela só segue pelo botão.` });
        }
        const semTexto = (f.acoes || []).filter((a) => !a.trim()).length;
        if (semTexto) out.push({ fase: f.id, texto: `${rot} tem ${plural(semTexto, 'ação sem texto, que é descartada', 'ações sem texto, que são descartadas')} ao salvar.` });
        const semDescricao = (f.documentos || []).filter((d) => !(d.descricao || '').trim()).length;
        if (semDescricao) out.push({ fase: f.id, texto: `${rot} tem ${plural(semDescricao, 'documento sem descrição, que é descartado', 'documentos sem descrição, que são descartados')} ao salvar.` });
        if ((f.modelos_ref || []).length > MAX_MODELOS_FASE) out.push({ fase: f.id, texto: `${rot} tem ${f.modelos_ref.length} modelos; cabem ${MAX_MODELOS_FASE} por fase e só os primeiros ficam.` });
        if (soltas.has(f.id)) out.push({ fase: f.id, texto: `${rot} não é alcançada: nenhuma fase segue para ela. Ligue-a no fluxo em "Encaminhamentos" de outra fase.` });
        if (presas.has(f.id)) out.push({ fase: f.id, texto: `${rot} entra num ciclo sem saída: dali o processo nunca chega a uma fase final.` });
        // Fase de espera sem unidade é o esperado: o processo aguarda onde está.
        if (!f.unidade_ref && !ehEspera(p.fases, i)) out.push({ fase: f.id, texto: `${rot} não tem unidade: a fase vai correr na unidade que estiver com o processo.` });
        if (f.espera && i === 0) out.push({ fase: f.id, texto: `${rot} é a primeira fase e não pode ser de espera: a marca é descartada ao salvar.` });
        if (!f.final && !ehEspera(p.fases, i)) {
            const saidas = (f.proximas || []).filter((id) => id !== f.id);
            if (!p.fases.some((x, k) => k > i && !ehEspera(p.fases, k)) && saidas.length === 0) out.push({ fase: f.id, texto: `${rot} é a última e não termina o processo: marque "O processo termina nesta fase" ou indique para onde segue.` });
            saidas.filter((id) => !ids.has(id)).forEach(() => out.push({ fase: f.id, grave: true, texto: `${rot} segue para uma fase que não existe mais.` }));
            saidas.filter((id) => f.condicoes_regra?.[id]).forEach((id) => {
                const c = f.condicoes_regra[id];
                const prob = problemaDaCondicao(f, c) || (c.valores.length ? null : 'está sem resposta marcada');
                const alvo = p.fases.find((x) => x.id === id)?.nome || 'outra fase';
                if (prob) out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a regra da saída para ${alvo} ${prob}. Ajuste em "Encaminhamentos".` });
            });
            // A saída para uma fase de espera é desvio eventual: não entra na conta das alternativas.
            const caminho = saidas.filter((id) => !ehEspera(p.fases, p.fases.findIndex((x) => x.id === id)));
            if (caminho.length > 1) {
                const semCond = caminho.filter((id) => !(f.condicoes?.[id] || '').trim() && !f.condicoes_regra?.[id]);
                if (semCond.length) out.push({ fase: f.id, texto: `${rot} tem ${caminho.length} saídas e ${semCond.length} sem condição: a equipe não saberá quando escolher cada uma.` });
            }
        }
    });
    return out;
}

/** Lê o arquivo e devolve a proposta (sem vínculo com o órgão). */
async function lerArquivo(file, orgId) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xlsm', 'xls', 'csv', 'ods'].includes(ext)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        // Todas as abas: as que detalham uma fase entram no lugar dela; as demais, em sequência.
        const abas = wb.SheetNames.map((nome) => ({ nome, linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, blankrows: false, defval: '' }) }));
        const r = propostaDeAbas(abas);
        return { ...r, origem: abas.length > 1 ? `planilha (${abas.length} abas)` : 'planilha' };
    }
    if (ext === 'docx' || ext === 'pdf' || ext === 'bpm') {
        const mime = ext === 'pdf' ? 'application/pdf' : ext === 'bpm' ? MIME_BIZAGI : MIME_DOCX;
        const r = await secConfig(orgId, 'extrairTextoRito', { arquivo: { base64: await arquivoParaBase64(file), mime, nome: file.name } });
        if (ext === 'bpm') return { ...propostaDeDiagramas(r.diagramas || []), origem: 'Bizagi' };
        // Tabelas do Word com coluna "Fase" valem mais que o texto corrido (todas, como abas).
        const tabelas = (r.tabelas || []).map((linhas, i) => ({ nome: `Tabela ${i + 1}`, linhas }));
        const p = tabelas.length ? propostaDeAbas(tabelas) : { fases: [] };
        if (p.fases.length > 1) return { ...p, origem: 'tabela do Word' };
        const t = propostaDeTexto(r.texto);
        if (!t.fases.length && ext === 'pdf') t.avisos = ['Li o PDF, mas não achei fases. Use títulos como "Fase 1 – Autuação" ou "1. Autuação" (um por fase), ou envie o diagrama (Bizagi, BPMN) ou uma planilha.'];
        return { ...t, origem: ext === 'pdf' ? 'texto do PDF' : 'texto do Word' };
    }
    return propostaDeConteudo(await file.text(), file.name);
}

/**
 * Tela única do rito, para criar e para editar. Criar: em branco, de um modelo
 * pronto ou lendo planilha, Word, PDF, BPMN, draw.io, Mermaid ou texto (o
 * sistema monta a proposta com unidades, ações, modelos e alternativas).
 * Editar: abre o rito gravado nesta mesma tela; salvar gera nova versão.
 * Implantar cria, de uma vez, as unidades e os modelos que faltam, o rito e,
 * se pedido, o tipo de processo. Monte com `key` por rito: o estado nasce das props.
 */
export default function PropostaRito({ aberto, orgId, estado, rito = null, copia = null, onFechar, onIr, onAbrirTipo, extra = null }) {
    const qc = useQueryClient();
    const editando = !!rito?.id;
    // Duplicar: nasce como rito novo, já com as fases do original (sem criar tipo junto).
    const [lendo, setLendo] = useState(false);
    const [colado, setColado] = useState('');
    const [p0] = useState(() => (editando ? deRito(rito) : copia ? deRito({ ...copia, id: undefined, nome: `${copia.nome} (cópia)` }) : null));
    const [p, setP] = useState(p0); // proposta vinculada
    const [inicial] = useState(() => (p0 ? JSON.stringify(p0) : null));
    // Já há tipos ativos no órgão: o rito novo não cria outro tipo, salvo se a pessoa pedir.
    const semTipos = !(estado.tipos || []).some((t) => t.ativo !== false);
    const [tipo, setTipo] = useState({ criar: !editando && !copia && semTipos, nome: '', sigla: '' });

    // Desfazer e refazer a revisão (só nesta tela; o rascunho guarda o estado atual).
    // Edições seguidas em menos de 0,7 s (digitar) viram um passo só; mudanças de estrutura, um passo cada.
    const hist = useRef({ antes: [], depois: [], em: 0 });
    const pAtual = useRef(p);
    pAtual.current = p;
    const [, setPassos] = useState(0);
    useEffect(() => { if (!p) hist.current = { antes: [], depois: [], em: 0 }; }, [p]);
    const editarP = (novo, passo = false) => {
        const h = hist.current;
        const agora = Date.now();
        if (passo || agora - h.em > 700 || !h.antes.length) h.antes = [...h.antes, pAtual.current].slice(-MAX_DESFAZER);
        h.em = passo ? 0 : agora;
        h.depois = [];
        setP(novo);
        setPassos((n) => n + 1);
    };
    const voltarPasso = (de, para) => {
        const h = hist.current;
        if (!h[de].length) return false;
        h[para] = [...h[para], pAtual.current].slice(-MAX_DESFAZER);
        const alvo = h[de][h[de].length - 1];
        h[de] = h[de].slice(0, -1);
        h.em = 0;
        setP(alvo);
        setConfirmar(false);
        setPassos((n) => n + 1);
        return true;
    };
    const desfazer = () => voltarPasso('antes', 'depois');
    const refazer = () => voltarPasso('depois', 'antes');
    /** Desfaz só se o último passo ainda é o que deixou `marca` (o botão do aviso não desfaz outra coisa). */
    const desfazerSe = (marca) => {
        const a = hist.current.antes;
        if (a[a.length - 1] === marca) desfazer();
        else toast.info('Já houve outras alterações depois desta. Use Desfazer, no rodapé, até voltar.');
    };
    const [confirmar, setConfirmar] = useState(false);
    const [implantando, setImplantando] = useState(false);
    const [criado, setCriado] = useState(null); // resumo após implantar
    const [rascunho, setRascunho] = useState(() => lerRascunho(orgId, rito?.id));
    // Editando com rascunho guardado: a pessoa decide antes de o rascunho ser sobrescrito.
    const [decidirRascunho, setDecidirRascunho] = useState(() => !!p0 && !!rascunho?.p);

    // Rascunho da revisão fica no navegador: fechar ou cair não perde o trabalho.
    useEffect(() => {
        if (!p || criado) return;
        const igual = inicial && JSON.stringify(p) === inicial;
        if (decidirRascunho) {
            // Mexer no rito sem recuperar o rascunho antigo é recusar o rascunho.
            if (igual) return;
            setDecidirRascunho(false);
        }
        // A cópia intacta não apaga o rascunho de rito novo que já estava guardado.
        if (igual) { if (editando) apagarRascunho(orgId, rito?.id); return; }
        try { localStorage.setItem(chaveRascunho(orgId, rito?.id), JSON.stringify({ p, tipo, em: Date.now(), versao: rito?.versao })); } catch { /* sem espaço: segue sem rascunho */ }
    }, [p, tipo, orgId, rito, inicial, criado, decidirRascunho]);
    const descartarRascunho = () => { apagarRascunho(orgId, rito?.id); setRascunho(null); setDecidirRascunho(false); };
    // Recuperar o rascunho mantém a versão atual: salvar não pode voltar a versão.
    const continuarRascunho = () => { setP({ ...rascunho.p, ...(editando ? { id: rito.id, versao: rito.versao } : {}) }); setTipo(rascunho.tipo || { criar: !editando, nome: rascunho.p.nome, sigla: '' }); setConfirmar(false); setDecidirRascunho(false); };

    const fechar = () => { setP(null); setColado(''); setConfirmar(false); setCriado(null); onFechar(); };
    // Editando, "Substituir fases" reabre o início: troca só as fases, o rito segue o mesmo.
    const [trocar, setTrocar] = useState(false);
    const manter = () => ({ id: p.id, versao: p.versao, ativo: p.ativo, nome: p.nome, descricao: p.descricao, exigir_tipo: p.exigir_tipo });
    const comecar = (r, criarTipo = true) => {
        // Modelo que cita unidades pelo nome: casa com as do órgão ou propõe criar, como num arquivo importado.
        const base = r.fases.some((f) => f.unidade) ? { exigir_tipo: false, ...vincularProposta(r, estado) } : deRito(r);
        if (trocar) { editarP({ ...base, ...manter() }, true); setTrocar(false); setConfirmar(false); return; }
        setP(base);
        setTipo({ criar: criarTipo && semTipos, nome: r.nome || '', sigla: '' });
        setConfirmar(false);
    };
    const carregar = (r, nomePadrao) => {
        if (!r.fases.length) { toast.error(r.avisos?.[0] || 'Não achei fases'); return; }
        const v = vincularProposta(r, estado);
        if (trocar) { editarP({ ...v, ...manter() }, true); setTrocar(false); setConfirmar(false); return; }
        const nome = r.nome || nomePadrao || 'Rito importado';
        setP({ ...v, nome, descricao: `Importado de ${r.origem || 'arquivo'}.` });
        setTipo({ criar: semTipos, nome, sigla: '' });
        setConfirmar(false);
    };
    const escolher = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        setLendo(true);
        try { carregar(await lerArquivo(file, orgId), file.name.replace(/\.[^.]+$/, '')); } catch (err) { toast.error(err?.message || 'Não foi possível ler o arquivo'); } finally { setLendo(false); }
    };
    const usarColado = async () => {
        setLendo(true);
        try { carregar(await propostaDeConteudo(colado)); } finally { setLendo(false); }
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[94vh] sm:max-w-[1400px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden"
                // Esc durante um arrasto cancela o arrasto, não fecha o editor.
                onEscapeKeyDown={(e) => { if (document.body.dataset.arrastando) e.preventDefault(); }}>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
                    <GitBranch className="w-5 h-5 text-indigo-600" aria-hidden />
                    <DialogTitle className="text-base truncate">{editando ? `Editar rito: ${rito.nome}` : 'Novo rito'}</DialogTitle>
                    {editando && <Badge variant="outline" className="font-normal">versão {rito.versao}</Badge>}
                    <DialogDescription className="sr-only">{editando ? 'Ajuste as fases, as ações e o que cada uma registra; salvar gera nova versão' : 'Comece em branco, de um modelo ou de um arquivo, revise e implante o rito'}</DialogDescription>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>
                {criado ? (
                    <ResumoImplantacao r={criado} onIr={(aba) => { fechar(); onIr?.(aba); }} onFechar={fechar} />
                ) : !p || trocar ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {trocar ? (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 p-3 text-sm">
                                    <span className="flex-1 min-w-[12rem]">As fases de <b>{p.nome}</b> serão trocadas pelas do modelo ou arquivo escolhido. O nome, a situação e as versões do rito continuam; nada é salvo até você confirmar.</span>
                                    <Button size="sm" variant="outline" onClick={() => setTrocar(false)}>Voltar sem trocar</Button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Comece em branco, de um modelo pronto ou de um arquivo que descreve o fluxo. Em todos os casos você revisa e ajusta
                                    tudo nesta mesma tela antes de implantar: fases, unidades, ações (e o que cada uma pede e registra), documentos,
                                    prazos e alternativas. Nada é criado até você confirmar.
                                </p>
                            )}
                            {!trocar && rascunho?.p && (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-sm">
                                    <span className="flex-1 min-w-[12rem]">Há uma revisão não implantada: <b>{rascunho.p.nome}</b> ({rascunho.p.fases.length} fases), de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</span>
                                    <Button size="sm" onClick={continuarRascunho}>Continuar a revisão</Button>
                                    <Button size="sm" variant="ghost" onClick={descartarRascunho}>Descartar</Button>
                                </div>
                            )}
                            <section aria-labelledby="comecar-titulo" className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 id="comecar-titulo" className="text-sm font-semibold">Começar sem arquivo</h3>
                                    <GuiaRito variante="ghost" className="ml-auto h-7 text-xs" />
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    <button type="button" onClick={() => comecar({ nome: '', descricao: '', fases: [{ id: novoIdFase(), nome: '', proximas: [] }] })}
                                        className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                        <p className="font-medium text-sm flex items-center gap-1.5"><FilePlus2 className="w-4 h-4 text-indigo-600" aria-hidden /> Em branco</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Uma fase vazia para montar do zero.</p>
                                    </button>
                                    {modelosDeRito().map((m) => (
                                        <button key={m.nome} type="button" onClick={() => comecar(m)}
                                            className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                            <p className="font-medium text-sm flex items-center gap-1.5"><LayoutTemplate className="w-4 h-4 text-indigo-600" aria-hidden /> {m.nome}</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{m.descricao}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{m.fases.map((f) => f.nome).join(' · ')}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <h3 className="text-sm font-semibold">Ou a partir de um arquivo</h3>
                            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                                {lendo ? <Loader2 className="w-7 h-7 animate-spin text-indigo-600" aria-hidden /> : <FileUp className="w-7 h-7 text-indigo-600" aria-hidden />}
                                <span className="font-medium">{lendo ? 'Lendo…' : 'Escolher arquivo'}</span>
                                <span className="text-xs text-slate-600">Planilha (Excel, CSV, todas as abas), Word, PDF, Bizagi (.bpm), BPMN, XPDL, draw.io, Mermaid ou texto · até {MAX_MB} MB</span>
                                <input type="file" accept={ACEITOS} className="sr-only" onChange={escolher} disabled={lendo} />
                            </label>
                            <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Planilha</b>Uma linha por fase ou por atividade. Colunas: Fase, Unidade, Responsável, Prazo, Ações, Documentos, Segue para, Condição, Orientação. Todas as abas são lidas: a aba com o nome de uma fase detalha essa fase.</div>
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Diagrama</b>Bizagi (.bpm, com todas as páginas), BPMN, XPDL, draw.io ou Mermaid. Raias viram unidades; losangos, alternativas; subprocessos se abrem em etapas.</div>
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Texto</b>Word, PDF ou TXT com "Fase 1 – Nome", "Unidade:", "Responsável:", "Prazo de N dias", itens e "Se…, segue para…".</div>
                            </div>
                            <div>
                                <Label htmlFor="rito-colado">Ou cole aqui (texto, linhas de planilha, Mermaid ou XML)</Label>
                                <Textarea id="rito-colado" rows={7} value={colado} onChange={(e) => setColado(e.target.value)} className="font-mono text-xs"
                                    placeholder={'Fase 1 – Autuação\nUnidade: Secretaria\nPrazo de 2 dias\n- Registrar o pedido\nFase 2 – Decisão\nUnidade: Gabinete\nSe deferido, segue para Cumprimento.\nSe indeferido, segue para Arquivamento.'} />
                                <Button size="sm" className="mt-2" disabled={!colado.trim() || lendo} onClick={usarColado}>Montar proposta</Button>
                            </div>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => baixarPlanilha(modelosDeRito()[1]?.fases || modelosDeRito()[0].fases, 'exemplo-de-rito')}>
                                <Download className="w-3.5 h-3.5" aria-hidden /> Baixar uma planilha de exemplo para preencher
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Revisao p={p} setP={editarP} estado={estado} semTipos={semTipos}
                        desfazer={desfazer} refazer={refazer} desfazerSe={desfazerSe} podeDesfazer={hist.current.antes.length > 0} podeRefazer={hist.current.depois.length > 0} tipo={tipo} setTipo={setTipo} confirmar={confirmar} setConfirmar={setConfirmar}
                        implantando={implantando} editando={editando} deCopia={!!copia} extra={extra}
                        rascunho={decidirRascunho ? rascunho : null} onContinuarRascunho={continuarRascunho} onDescartarRascunho={descartarRascunho}
                        onVoltar={() => { setRascunho(lerRascunho(orgId)); setP(null); }}
                        onTrocarFases={() => setTrocar(true)}
                        onAbrirTipo={onAbrirTipo ? (id) => { fechar(); onAbrirTipo(id); } : null}
                        onExcluir={async () => {
                            try {
                                await secConfig(orgId, 'excluirRito', { id: rito.id });
                                toast.success('Rito excluído');
                                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
                                apagarRascunho(orgId, rito.id);
                                fechar();
                            } catch (e) { toast.error(e?.message || 'Não foi possível excluir o rito'); }
                        }}
                        onImplantar={async () => {
                            setImplantando(true);
                            try {
                                const payload = montarPayload(p, tipo);
                                const r = await secConfig(orgId, 'aplicarPropostaRito', { proposta: payload });
                                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
                                apagarRascunho(orgId, rito?.id);
                                setRascunho(null);
                                if (editando && !payload.unidades.length && !payload.modelos.length && !payload.tipo_processo) {
                                    toast.success(`Rito salvo (versão ${r.versao}). Processos em andamento seguem com a versão com que foram autuados; para trazê-los, use "Atualizar processos" no menu do rito.`);
                                    fechar();
                                    return;
                                }
                                toast.success(editando ? `Rito salvo (versão ${r.versao})` : 'Rito implantado');
                                setCriado({ nome: p.nome, fases: p.fases.length, unidades: payload.unidades.map((u) => u.nome), modelos: payload.modelos.map((m) => m.nome), tipo: payload.tipo_processo?.nome || null, editado: editando, ativo: p.ativo !== false, ...r });
                                setP(null);
                            } catch (e) { toast.error(e?.message || (editando ? 'Não foi possível salvar o rito' : 'Não foi possível implantar')); setConfirmar(false); } finally { setImplantando(false); }
                        }} />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Depois de implantar: o que foi criado e para onde ir em seguida. */
function ResumoImplantacao({ r, onIr, onFechar }) {
    const n = (k, s, pl) => `${k} ${k === 1 ? s : pl}`;
    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" aria-hidden />
                    <div>
                        <h3 className="text-lg font-semibold">Rito “{r.nome}” {r.editado ? `salvo (versão ${r.versao})` : 'implantado'}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{r.editado ? `Rito com ${n(r.fases, 'fase', 'fases')}` : `Foram criados: 1 rito com ${n(r.fases, 'fase', 'fases')}`}{r.unidades.length ? `, ${n(r.unidades.length, 'unidade', 'unidades')}` : ''}{r.modelos.length ? `, ${n(r.modelos.length, 'modelo', 'modelos')}` : ''}{r.tipo ? ', 1 tipo de processo' : ''}.</p>
                    </div>
                </div>
                <ul className="space-y-3 text-sm">
                    {r.unidades.length > 0 && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Unidades novas:</b> {r.unidades.join(', ')}. Elas ainda não têm ninguém lotado.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('unidades')}>Montar as equipes</Button>
                        </li>
                    )}
                    {r.modelos.length > 0 && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Modelos novos:</b> {r.modelos.join(', ')}. Saíram com um texto-base; complete o conteúdo.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('documentos')}>Completar os modelos</Button>
                        </li>
                    )}
                    {r.tipo && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <Shapes className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Tipo de processo:</b> {r.tipo}, já ativo e ligado a este rito.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('tipos')}>Ver os tipos</Button>
                        </li>
                    )}
                    <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                        <span className="flex-1 min-w-[12rem]">{r.ativo ? 'O rito está ativo. Use “Ver como a equipe e a parte” no topo para conferir cada fase.' : 'O rito está inativo: não aparece para novas autuações até ser marcado como disponível.'}</span>
                        {!r.editado && <Button size="sm" variant="outline" onClick={() => onIr('ritos')}>Abrir o rito</Button>}
                    </li>
                </ul>
                <Button onClick={onFechar}>Fechar</Button>
            </div>
        </div>
    );
}

function Revisao({
    p, setP, estado, tipo, setTipo, confirmar, setConfirmar, implantando, onVoltar, onImplantar,
    editando = false, deCopia = false, extra = null, rascunho = null, onContinuarRascunho, onDescartarRascunho, onExcluir, onTrocarFases, onAbrirTipo = null,
    semTipos = true, desfazer, refazer, desfazerSe, podeDesfazer = false, podeRefazer = false,
}) {
    const [excluir, setExcluir] = useState(false);
    const [copiarDe, setCopiarDe] = useState(false);
    const tiposDoRito = editando ? (estado.tipos || []).filter((t) => t.rito_id === p.id) : [];
    const existentes = estado.unidades.filter((u) => u.ativa !== false);
    const nomeUnidade = (ref) => existentes.find((u) => u.id === ref)?.nome || p.unidades.find((u) => u.ref === ref)?.nome || '';
    const nomeModelo = (ref) => (estado.modelos || []).find((m) => m.id === ref)?.nome || p.modelos.find((m) => m.ref === ref)?.nome || 'Modelo excluído (sai ao salvar)';
    const mudarFase = (id, d) => { setConfirmar(false); setP({ ...p, fases: p.fases.map((f) => (f.id === id ? { ...f, ...d } : f)) }); };
    const moverPara = (de, para) => { setConfirmar(false); setP({ ...p, fases: mudarDeLugar(p.fases, de, para) }, true); };
    const mover = (i, delta) => moverPara(i, i + delta);
    const nomeFase = (f, i) => (f?.nome.trim() ? `a fase ${f.nome.trim()}` : `a fase ${i + 1}`);
    // Inserir e duplicar: a fase nova entra logo abaixo e abre para editar.
    const inserirEm = (i, fase, aviso) => {
        setConfirmar(false);
        const fs = [...p.fases];
        fs.splice(i, 0, fase);
        setP({ ...p, fases: fs }, true);
        irParaFase(fase.id);
        if (aviso) toast.success(aviso);
    };
    const inserirAbaixo = (i) => inserirEm(i + 1, { id: novoIdFase(), nome: '', proximas: [] });
    // A fase que segue para a de baixo sem dizer passa a dizer; a última sem saída passa a ser final.
    // Assim a fase que entra logo abaixo (ou no fim) não muda o caminho de quem já estava lá.
    const fixarSaida = (fases, i) => {
        const f = fases[i];
        if (!f || f.final || ehEspera(fases, i) || (f.proximas || []).some((x) => x !== f.id && fases.some((y) => y.id === x))) return fases;
        const seguinte = fases.find((x, k) => k > i && !ehEspera(fases, k));
        const fixa = seguinte ? { proximas: [seguinte.id] } : { final: true };
        return fases.map((x, k) => (k === i ? { ...x, ...fixa } : x));
    };
    const duplicar = (i) => {
        const f = p.fases[i];
        const [c] = copiarFases([f], new Set(p.fases.map((x) => x.id)), p.fases);
        delete c.sem_saida;
        c.nome = `${f.nome.trim() || `Fase ${i + 1}`} (cópia)`;
        const fs = fixarSaida(p.fases, i);
        setConfirmar(false);
        setP({ ...p, fases: [...fs.slice(0, i + 1), c, ...fs.slice(i + 1)] }, true);
        irParaFase(c.id);
        toast.success('Fase duplicada. Nenhuma fase segue para a cópia ainda: ligue-a em "Encaminhamentos" de outra fase.');
    };
    const copiarDeOutro = (escolhidas, origem) => {
        const copias = copiarFases(escolhidas, new Set(), origem);
        const finais = copias.filter((c) => c.sem_saida).map((c) => c.nome);
        copias.forEach((c) => delete c.sem_saida);
        setConfirmar(false);
        setP({ ...p, fases: [...fixarSaida(p.fases, p.fases.length - 1), ...copias] }, true);
        setCopiarDe(false);
        if (copias[0]) irParaFase(copias[0].id);
        toast.success(`${plural(copias.length, 'fase copiada', 'fases copiadas')} para o fim do rito. Ligue-as no fluxo em "Encaminhamentos" de outra fase.${
            finais.length ? ` ${finais.join(', ')} ${finais.length > 1 ? 'seguiam para fases não copiadas e ficaram como finais' : 'seguia para fases não copiadas e ficou como final'}.` : ''}`, { duration: 8000 });
    };
    // "Aplicar a todas as fases": o mesmo registro dos outros atos em todo o rito.
    const outrosEmTodas = (outros) => { setConfirmar(false); setP({ ...p, fases: p.fases.map((f) => ({ ...f, registro_atos: registroComOutros(f, outros), registro: undefined })) }); };
    const remover = (id) => {
        const i = p.fases.findIndex((f) => f.id === id);
        setConfirmar(false);
        setP({ ...p, fases: tirarDoGrupo(p.fases, id).filter((f) => f.id !== id).map((f) => ({ ...f, proximas: (f.proximas || []).filter((x) => x !== id) })) }, true);
        const marca = p;
        toast(`${nomeFase(p.fases[i], i).replace(/^a /, 'A ')} foi removida.`, { action: { label: 'Desfazer', onClick: () => desfazerSe(marca) } });
        // O foco vai para a fase vizinha (ou para "Adicionar fase"), não se perde no corpo da página.
        const vizinha = p.fases[i + 1] || p.fases[i - 1];
        setTimeout(() => (document.querySelector(vizinha ? `#fase-${vizinha.id} button[aria-expanded]` : '#pr-add-fase'))?.focus(), 60);
    };
    // Unidade nova criada a partir de uma fase, já ligada a ela (um só setP).
    const novaUnidade = (faseId) => {
        const ref = `+${Date.now().toString(36)}`;
        setP({
            ...p, unidades: [...p.unidades, { ref, nome: 'Nova unidade', tipo: 'outra' }],
            fases: p.fases.map((f) => (f.id === faseId ? { ...f, unidade_ref: ref } : f)),
        });
    };
    const addModelo = (fase, nome) => {
        const n = sem(nome);
        if (!n) return;
        const exist = (estado.modelos || []).find((m) => sem(m.nome) === n && (!m.unidade_id || m.unidade_id === fase.unidade_ref));
        let ref = exist?.id || p.modelos.find((m) => sem(m.nome) === n && m.unidade_ref === fase.unidade_ref)?.ref;
        let modelos = p.modelos;
        if (!ref) { ref = `+${Date.now().toString(36)}`; modelos = [...modelos, { ref, nome: nome.trim(), unidade_ref: fase.unidade_ref || null, tipo_documento: tipoDocumentoDe(nome, estado) }]; }
        setP({ ...p, modelos, fases: p.fases.map((f) => (f.id === fase.id ? { ...f, modelos_ref: [...new Set([...(f.modelos_ref || []), ref])] } : f)) });
    };
    // Unidade ou modelo novo trocado por um existente: troca a referência em tudo.
    const trocarUnidade = (ref, id) => setP({
        ...p, unidades: p.unidades.filter((u) => u.ref !== ref),
        fases: p.fases.map((f) => (f.unidade_ref === ref ? { ...f, unidade_ref: id } : f)),
        modelos: p.modelos.map((m) => (m.unidade_ref === ref ? { ...m, unidade_ref: id } : m)),
    });
    const trocarModelo = (ref, id) => setP({
        ...p, modelos: p.modelos.filter((m) => m.ref !== ref),
        fases: p.fases.map((f) => ({ ...f, modelos_ref: [...new Set((f.modelos_ref || []).map((x) => (x === ref ? id : x)).filter(Boolean))] })),
    });
    const usadosUn = useMemo(() => new Set([...p.fases.map((f) => f.unidade_ref), ...p.modelos.map((m) => m.unidade_ref)].filter(Boolean)), [p]);
    const usadosMod = useMemo(() => new Set(p.fases.flatMap((f) => f.modelos_ref || [])), [p]);
    const unNovas = p.unidades.filter((u) => usadosUn.has(u.ref));
    const modNovos = p.modelos.filter((m) => usadosMod.has(m.ref));
    const ligadas = useMemo(() => integracoesLigadas(estado), [estado]);
    const { paginas, paginasProntas } = useContext(RegistroContexto);
    const pendencias = useMemo(() => pendenciasDaProposta(p, ligadas, paginasProntas ? paginas : null), [p, ligadas, paginas, paginasProntas]);
    const graves = pendencias.filter((x) => x.grave);
    const fluxoComProblema = useMemo(() => { const r = problemasDoFluxo(p.fases); return new Set([...r.soltas, ...r.presas]); }, [p.fases]);
    const outrosRitos = (estado.ritos || []).filter((r) => r.id !== p.id && (r.fases || []).length);
    // Implantar sempre responde: com pendência que impede, leva até ela e diz o que falta.
    const tentarImplantar = () => {
        if (!p.nome.trim()) {
            toast.error('Dê um nome ao rito.');
            const el = document.getElementById('pr-nome');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
            return;
        }
        if (graves.length) {
            toast.error(graves.length > 1 ? `Faltam ${graves.length} correções. A primeira: ${graves[0].texto}` : graves[0].texto);
            if (graves[0].fase) irParaFase(graves[0].fase);
            return;
        }
        setConfirmar(true);
    };
    // Atalhos Ctrl+Z e Ctrl+Shift+Z (ou Ctrl+Y) fora dos campos de texto, que têm o desfazer deles; os botões fazem o mesmo.
    const teclas = (e) => {
        // Com outro diálogo por cima (prévia, versões, copiar, excluir), o atalho é dele, não do rito escondido.
        if (!(e.ctrlKey || e.metaKey) || ehCampoDeTexto(e.target) || document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length > 1) return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey && podeDesfazer) { e.preventDefault(); voltar(); }
        else if (((k === 'z' && e.shiftKey) || k === 'y') && podeRefazer) { e.preventDefault(); avancar(); }
    };
    // Leitor de tela: avisa o que desfazer, refazer e mover pelo menu fizeram.
    const [aviso, setAviso] = useState('');
    const anunciar = (t) => setAviso((a) => (a === t ? `${t}\u00a0` : t));
    const voltar = () => { desfazer(); anunciar('Alteração desfeita.'); };
    const avancar = () => { refazer(); anunciar('Alteração refeita.'); };
    // Fases recolhidas por padrão quando são muitas: a lista cabe na tela e o fluxo guia a revisão.
    const [abertas, setAbertas] = useState(() => new Set(p.fases.length <= 6 ? p.fases.map((f) => f.id) : []));
    const [sel, setSel] = useState(null);
    const alternar = (id) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const irParaFase = (id) => {
        setSel(id);
        setAbertas((s) => new Set(s).add(id));
        // Espera o cartão abrir para rolar até ele e pôr o foco no nome da fase.
        setTimeout(() => {
            document.getElementById(`fase-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.getElementById(`nome-${id}`)?.focus({ preventScroll: true });
        }, 60);
    };
    const comPendencia = useMemo(() => new Set(pendencias.map((x) => x.fase)), [pendencias]);
    const fluxo = useMemo(() => p.fases.filter((f) => f.nome.trim()).map((f) => ({ ...f, proximas: f.final ? [] : f.proximas, raia: nomeUnidade(f.unidade_ref) })),
        [p.fases, p.unidades, estado.unidades]);
    const todasAbertas = abertas.size >= p.fases.length;
    const teclasAtual = useRef(teclas);
    teclasAtual.current = teclas;
    useEffect(() => {
        const h = (e) => teclasAtual.current(e);
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, []);

    return (
        <>
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 pb-0 space-y-3">
                    {rascunho?.p && (
                        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-sm">
                            {deCopia ? (
                                <span className="flex-1 min-w-[12rem]">Há um rito novo não implantado, <b>{rascunho.p.nome}</b>, de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Mexer nesta cópia substitui aquele rascunho.</span>
                            ) : (
                                <span className="flex-1 min-w-[12rem]">Há alterações não salvas deste rito, de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{rascunho.versao && rascunho.versao !== p.versao ? `, feitas sobre a versão ${rascunho.versao} (a atual é a ${p.versao})` : ''}.</span>
                            )}
                            <Button size="sm" onClick={onContinuarRascunho}>{deCopia ? 'Abrir aquele rascunho' : 'Recuperar as alterações'}</Button>
                            <Button size="sm" variant="ghost" onClick={onDescartarRascunho}>Descartar</Button>
                        </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div><Label htmlFor="pr-nome">Nome do rito</Label><Input id="pr-nome" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
                        <div><Label htmlFor="pr-desc">Descrição</Label><Input id="pr-desc" value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></div>
                        <div className="sm:col-span-2">
                            <label className="flex items-start gap-2 text-sm min-h-[2.75rem] sm:min-h-0">
                                <Checkbox className="mt-0.5" checked={p.exigir_tipo === true} onCheckedChange={(x) => setP({ ...p, exigir_tipo: x === true })} aria-describedby="pr-exigir-tipo-ajuda" />
                                <span>Autuar só por um tipo de processo</span>
                            </label>
                            <p id="pr-exigir-tipo-ajuda" className="text-xs text-slate-600 dark:text-slate-400 pl-6">
                                No "Novo processo", este rito some da opção "Sem tipo": quem autua escolhe um tipo que o use (com o formulário e a numeração do tipo).
                                {p.exigir_tipo && !(estado.tipos || []).some((t) => t.ativo !== false && p.id && t.rito_id === p.id) && !(tipo?.criar && (tipo.nome || p.nome || '').trim()) && (
                                    <span className="block mt-1 text-amber-800 dark:text-amber-200">Nenhum tipo ativo usa este rito ainda: até criar um, ninguém consegue autuar por ele.</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <section aria-label="Fluxo do rito" className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><GitBranch className="w-4 h-4" aria-hidden /> Fluxo</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300">Uma raia por unidade. A fase é a moldura; dentro dela, cada ação é uma caixa. Clique numa fase para abrir e ajustar.</p>
                            <GuiaRito variante="ghost" className="ml-auto h-7 text-xs" />
                        </div>
                        {fluxo.length > 0
                            ? <FluxoRito acoes fases={fluxo} atual={sel} onSelecionar={irParaFase} legenda alturaMaxima="62vh" alertas={fluxoComProblema} />
                            : <p className="text-sm text-slate-600">Dê nome às fases para ver o fluxo.</p>}
                    </section>
                </div>
                <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 p-4">
                    <div className="space-y-3 min-w-0">
                        {p.avisos?.length > 0 && (
                            <details className="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 p-3 text-xs" open={p.avisos.length <= 3}>
                                <summary className="cursor-pointer font-semibold">{p.avisos.length} {p.avisos.length > 1 ? 'observações' : 'observação'} da leitura do arquivo</summary>
                                <ul className="mt-2 space-y-1">
                                    {p.avisos.slice(0, 12).map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />{a}</li>)}
                                </ul>
                            </details>
                        )}
                        {pendencias.length > 0 && (
                            <section aria-label="Pendências" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
                                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" aria-hidden /> {plural(pendencias.length, 'pendência', 'pendências')} {editando ? 'antes de salvar' : 'antes de implantar'}{graves.length ? ` (${graves.length} ${graves.length > 1 ? 'impedem' : 'impede'})` : ''}</h3>
                                <ul className="mt-1.5 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                                    {pendencias.slice(0, 10).map((x, k) => (
                                        <li key={k} className="flex flex-wrap items-center gap-2">
                                            <span className="flex-1 min-w-[10rem]">{x.grave ? <b>Impede: </b> : ''}{x.texto}</span>
                                            <button type="button" className="min-h-[2.75rem] sm:min-h-0 px-1 underline underline-offset-2 font-medium" onClick={() => irParaFase(x.fase)} hidden={!x.fase}>{x.grave ? 'Corrigir' : 'Ver'}</button>
                                        </li>
                                    ))}
                                    {pendencias.length > 10 && <li>e mais {pendencias.length - 10}…</li>}
                                </ul>
                            </section>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <h3 className="text-sm font-semibold">{plural(p.fases.length, 'fase', 'fases')}</h3>
                            {p.fases.length > 10 && (
                                <select aria-label="Ir para a fase" value="" onChange={(e) => e.target.value && irParaFase(e.target.value)} className={`${campo} h-8 max-w-[14rem] text-xs`}>
                                    <option value="">Ir para a fase…</option>
                                    {p.fases.map((f, i) => <option key={f.id} value={f.id}>{i + 1}. {f.nome.trim() || 'Fase sem nome'}</option>)}
                                </select>
                            )}
                            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setAbertas(new Set(todasAbertas ? [] : p.fases.map((f) => f.id)))}>{todasAbertas ? 'Recolher todas' : 'Abrir todas'}</Button>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 -mt-1">Arraste pela alça <span aria-hidden>⋮⋮</span> (ou use o teclado) para mudar a ordem. No menu de cada fase: inserir, duplicar, mover e remover.</p>
                        <ListaOrdenavel ids={p.fases.map((f) => f.id)} nome={(id) => { const i = p.fases.findIndex((f) => f.id === id); return nomeFase(p.fases[i], i); }} onMover={moverPara}>
                            {p.fases.map((f, i) => (
                                <CartaoFase key={f.id} f={f} i={i} total={p.fases.length} fases={p.fases} existentes={existentes} unidadesNovas={p.unidades}
                                    aberta={abertas.has(f.id)} onAlternar={() => alternar(f.id)} selecionada={sel === f.id} pendente={comPendencia.has(f.id)} unidadeNome={nomeUnidade(f.unidade_ref)}
                                    nomeModelo={nomeModelo} modelos={estado.modelos || []} mudar={(d) => mudarFase(f.id, d)} ligadas={ligadas}
                                    mover={(d) => { mover(i, d); anunciar(`${nomeFase(f, i).replace(/^a /, 'A ')} foi para a posição ${i + d + 1} de ${p.fases.length}.`); }}
                                    moverPara={(para) => { moverPara(i, para); anunciar(`${nomeFase(f, i).replace(/^a /, 'A ')} foi para a posição ${para + 1} de ${p.fases.length}.`); }} remover={() => remover(f.id)}
                                    inserirAbaixo={() => inserirAbaixo(i)} duplicar={() => duplicar(i)}
                                    novaUnidade={() => novaUnidade(f.id)} addModelo={(n) => addModelo(f, n)} outrosEmTodas={outrosEmTodas} />
                            ))}
                        </ListaOrdenavel>
                        <div className="flex flex-wrap gap-2">
                            <Button id="pr-add-fase" variant="outline" size="sm" className="gap-1" onClick={() => inserirEm(p.fases.length, { id: novoIdFase(), nome: '', proximas: [] })}><Plus className="w-4 h-4" /> Adicionar fase</Button>
                            {outrosRitos.length > 0 && <Button variant="outline" size="sm" className="gap-1" onClick={() => setCopiarDe(true)}><CopyPlus className="w-4 h-4" aria-hidden /> Copiar fases de outro rito</Button>}
                        </div>
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                        {editando && (
                            <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <h3 className="text-sm font-semibold">Situação</h3>
                                <label className="flex items-center gap-2 text-sm"><Checkbox checked={p.ativo !== false} onCheckedChange={(c) => setP({ ...p, ativo: c === true })} /> Disponível para novas autuações</label>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {tiposDoRito.length ? `Usado por: ${tiposDoRito.map((t) => t.nome).join(', ')}.` : 'Nenhum tipo de processo usa este rito.'} Processos em andamento seguem com a versão com que foram autuados.
                                </p>
                                {extra}
                            </section>
                        )}
                        {p.fases.some((f) => f.nome.trim()) && (
                            <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <h3 className="text-sm font-semibold">Exportar</h3>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" onClick={() => baixarPlanilha(p.fases, p.nome)}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Planilha</Button>
                                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copiarTexto(ritoParaMermaid(p.fases), 'Diagrama copiado em Mermaid')}><Copy className="w-4 h-4" aria-hidden /> Diagrama (Mermaid)</Button>
                                </div>
                            </section>
                        )}
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4" aria-hidden /> Unidades novas ({unNovas.length})</h3>
                            {unNovas.length === 0 && <p className="text-xs text-slate-600">Todas as unidades citadas já existem no órgão.</p>}
                            {unNovas.map((u) => (
                                <div key={u.ref} className="space-y-1.5 border-t first:border-0 border-slate-100 dark:border-slate-800 pt-2 first:pt-0">
                                    <div className="flex gap-2">
                                        <Input aria-label="Nome da unidade nova" value={u.nome} onChange={(e) => setP({ ...p, unidades: p.unidades.map((x) => (x.ref === u.ref ? { ...x, nome: e.target.value } : x)) })} className="h-8" />
                                        <select aria-label="Tipo da unidade nova" value={u.tipo} onChange={(e) => setP({ ...p, unidades: p.unidades.map((x) => (x.ref === u.ref ? { ...x, tipo: e.target.value } : x)) })} className={`${campo} h-8`}>
                                            {Object.entries(TIPOS_UNIDADE).map(([k, t]) => <option key={k} value={k}>{t.rotulo}</option>)}
                                        </select>
                                    </div>
                                    {existentes.length > 0 && (
                                        <select aria-label={`Usar uma unidade existente no lugar de ${u.nome}`} value="" onChange={(e) => e.target.value && trocarUnidade(u.ref, e.target.value)} className={`${campo} h-8 w-full text-xs`}>
                                            <option value="">Ou usar uma unidade que já existe…</option>
                                            {existentes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </section>
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-4 h-4" aria-hidden /> Modelos novos ({modNovos.length})</h3>
                            {modNovos.length === 0 && <p className="text-xs text-slate-600">Nenhum modelo novo. Documentos citados nas fases aparecem aqui.</p>}
                            {modNovos.map((m) => (
                                <div key={m.ref} className="space-y-1.5 border-t first:border-0 border-slate-100 dark:border-slate-800 pt-2 first:pt-0">
                                    <div className="flex gap-2">
                                        <Input aria-label="Nome do modelo novo" value={m.nome} onChange={(e) => setP({ ...p, modelos: p.modelos.map((x) => (x.ref === m.ref ? { ...x, nome: e.target.value } : x)) })} className="h-8" />
                                        <select aria-label="Tipo de documento" value={m.tipo_documento || ''} onChange={(e) => setP({ ...p, modelos: p.modelos.map((x) => (x.ref === m.ref ? { ...x, tipo_documento: e.target.value } : x)) })} className={`${campo} h-8 max-w-[9rem]`}>
                                            <option value="">Qualquer tipo</option>
                                            {(estado.documento?.tipos_documento || []).map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-xs text-slate-600">{m.unidade_ref ? `Da unidade ${nomeUnidade(m.unidade_ref)}` : 'Do órgão'} · sai com um texto-base com campos automáticos para completar.</p>
                                    {(estado.modelos || []).length > 0 && (
                                        <select aria-label={`Usar um modelo existente no lugar de ${m.nome}`} value="" onChange={(e) => e.target.value && trocarModelo(m.ref, e.target.value)} className={`${campo} h-8 w-full text-xs`}>
                                            <option value="">Ou usar um modelo que já existe…</option>
                                            {estado.modelos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </section>
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={tipo.criar} onCheckedChange={(c) => setTipo({ ...tipo, criar: c === true })} /> Criar tipo de processo com este rito</label>
                            {!tipo.criar && !editando && !semTipos && <p className="text-xs text-slate-600 dark:text-slate-300">O órgão já tem tipos de processo. Para um deles usar este rito, escolha o rito no tipo, depois de implantar; ou marque para criar um tipo novo.</p>}
                            {tipo.criar && (
                                <div className="flex gap-2">
                                    <Input aria-label="Nome do tipo de processo" placeholder={p.nome} value={tipo.nome} onChange={(e) => setTipo({ ...tipo, nome: e.target.value })} className="h-8" />
                                    <Input aria-label="Sigla" placeholder="Sigla" value={tipo.sigla} onChange={(e) => setTipo({ ...tipo, sigla: e.target.value })} className="h-8 w-24" />
                                </div>
                            )}
                            {tipo.criar && <p className="text-xs text-slate-600">Começa na unidade da primeira fase{p.fases[0]?.unidade_ref ? ` (${nomeUnidade(p.fases[0].unidade_ref)})` : ''}.</p>}
                        </section>
                    </aside>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
                {editando
                    ? <Button variant="ghost" className="gap-1 text-red-700 dark:text-red-300" onClick={() => setExcluir(true)}><Trash2 className="w-4 h-4" aria-hidden /> Excluir rito</Button>
                    : <Button variant="ghost" onClick={onVoltar}>Voltar ao início</Button>}
                {editando && <Button variant="ghost" className="gap-1" onClick={onTrocarFases}><FileUp className="w-4 h-4" aria-hidden /> Substituir fases</Button>}
                <div className="flex" role="group" aria-label="Desfazer e refazer">
                    <Button variant="ghost" size="icon" className={ICONE} disabled={!podeDesfazer} onClick={voltar} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className={ICONE} disabled={!podeRefazer} onClick={avancar} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)"><Redo2 className="w-4 h-4" /></Button>
                </div>
                <p className="sr-only" aria-live="polite">{aviso}</p>
                <PreviaRito estado={estado} rascunho={p} rotuloBotao="Prévia" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Rascunho salvo neste navegador.</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 ml-auto text-right">
                    {editando ? `Será salvo como versão ${(p.versao || 1) + 1} (${p.fases.length} fases)` : `Será criado: 1 rito (${p.fases.length} fases)`}{unNovas.length ? `, ${unNovas.length} unidade${unNovas.length > 1 ? 's' : ''} nova${unNovas.length > 1 ? 's' : ''}` : ''}{modNovos.length ? `, ${modNovos.length} modelo${modNovos.length > 1 ? 's' : ''} novo${modNovos.length > 1 ? 's' : ''}` : ''}{tipo.criar && (tipo.nome || p.nome).trim() ? ', 1 tipo de processo' : ''}.
                </p>
                {confirmar ? (
                    <>
                        <Button variant="outline" onClick={() => setConfirmar(false)} disabled={implantando}>Revisar mais</Button>
                        <Button className="gap-1" onClick={onImplantar} disabled={implantando}>{implantando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {editando ? 'Confirmar e salvar' : 'Confirmar implantação'}</Button>
                    </>
                ) : (
                    <Button className="gap-1" onClick={tentarImplantar} aria-describedby={graves.length || !p.nome.trim() ? 'pr-impede' : undefined}>
                        {editando ? <><Save className="w-4 h-4" /> Salvar alterações</> : <><Rocket className="w-4 h-4" /> Implantar rito</>}
                    </Button>
                )}
                {(graves.length > 0 || !p.nome.trim()) && !confirmar && (
                    <p id="pr-impede" className="basis-full text-right text-xs text-amber-800 dark:text-amber-200">
                        {!p.nome.trim() ? 'Falta o nome do rito.' : `${plural(graves.length, 'pendência impede', 'pendências impedem')} ${editando ? 'salvar' : 'implantar'}: clique para ir até ${graves.length > 1 ? 'a primeira' : 'ela'}.`}
                    </p>
                )}
            </div>
            <CopiarFasesDeRito aberto={copiarDe} ritos={outrosRitos} onFechar={() => setCopiarDe(false)} onCopiar={copiarDeOutro} />
            <AlertDialog open={excluir} onOpenChange={setExcluir}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir o rito “{p.nome}”?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                {tiposDoRito.length
                                    ? <BloqueioRito tipos={tiposDoRito} onAbrirTipo={onAbrirTipo} />
                                    : <p>O rito sai das listas e não pode mais ser usado em novas autuações. Os processos já autuados seguem com as fases que copiaram dele, e o histórico fica guardado. Dá para restaurar depois, em “Excluídos”. Se só quer parar de usá-lo por um tempo, desmarque “Disponível para novas autuações”.</p>}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        {!tiposDoRito.length && <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onExcluir}>Excluir rito</AlertDialogAction>}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/** Escolhe um rito do órgão e as fases dele para copiar para este (entram no fim, com ids novos). */
function CopiarFasesDeRito({ aberto, ritos, onFechar, onCopiar }) {
    const [ritoId, setRitoId] = useState('');
    const [marcadas, setMarcadas] = useState(null); // null = todas
    const rito = ritos.find((r) => r.id === ritoId) || ritos[0];
    const fases = useMemo(() => (rito ? deRito(rito).fases : []), [rito]);
    const escolhidas = marcadas ?? fases.map((f) => f.id);
    const fechar = () => { setRitoId(''); setMarcadas(null); onFechar(); };
    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                <DialogTitle>Copiar fases de outro rito</DialogTitle>
                <DialogDescription>As fases escolhidas entram no fim deste rito, com tudo o que têm: ações, regras, documentos, modelos e unidade. Os caminhos entre elas são mantidos; os que levavam a fases não copiadas saem, e a fase que fica sem saída vira final. Nenhuma fase deste rito passa a seguir para elas até você ligar.</DialogDescription>
                <div className="space-y-3">
                    <div>
                        <Label htmlFor="cf-rito">Rito</Label>
                        <select id="cf-rito" value={rito?.id || ''} onChange={(e) => { setRitoId(e.target.value); setMarcadas(null); }} className={`${campo} mt-1 w-full`}>
                            {ritos.map((r) => <option key={r.id} value={r.id}>{r.nome} ({plural((r.fases || []).length, 'fase', 'fases')})</option>)}
                        </select>
                    </div>
                    <fieldset>
                        <legend className="text-sm font-medium flex items-center gap-2">
                            Fases
                            <button type="button" className="text-xs font-normal underline underline-offset-2" onClick={() => setMarcadas(escolhidas.length === fases.length ? [] : null)}>
                                {escolhidas.length === fases.length ? 'Desmarcar todas' : 'Marcar todas'}
                            </button>
                        </legend>
                        <ul className="mt-1 space-y-0.5">
                            {fases.map((f, i) => (
                                <li key={f.id}>
                                    <label className="flex min-h-[2.75rem] sm:min-h-0 items-center gap-2 text-sm py-0.5">
                                        <Checkbox checked={escolhidas.includes(f.id)} onCheckedChange={(c) => setMarcadas(c === true ? [...escolhidas, f.id] : escolhidas.filter((x) => x !== f.id))} />
                                        <span>{i + 1}. {f.nome}{(f.acoes || []).length ? <span className="text-xs text-slate-600 dark:text-slate-400"> · {plural(f.acoes.length, 'ação', 'ações')}</span> : null}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </fieldset>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={fechar}>Cancelar</Button>
                    <Button disabled={!escolhidas.length} onClick={() => { onCopiar(fases.filter((f) => escolhidas.includes(f.id)), fases); setRitoId(''); setMarcadas(null); }}>
                        Copiar {plural(escolhidas.length, 'fase', 'fases')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Parte recolhível do cartão da fase, com o resumo à vista quando fechada. */
/** Resumo do que a fase faz sozinha (para o título recolhido da seção). */
const resumoEntrada = (f) => [
    f.prazo_auto && f.prazo_dias ? `abre prazo de ${f.prazo_dias} dias` : null,
    f.nome_publico?.trim() ? `partes veem "${f.nome_publico.trim()}"` : null,
    f.ao_entrar?.urgente ? 'marca urgente' : null,
    f.ao_entrar?.sem_responsavel ? 'tira o responsável' : null,
].filter(Boolean).join('; ') || 'nada automático';

/** Prazo automático, nome para as partes e efeitos ao entrar na fase. */
function AoEntrarNaFase({ f, i, mudar }) {
    const ae = f.ao_entrar || {};
    const setAe = (k, v) => {
        const n = { ...ae, [k]: v || undefined };
        Object.keys(n).forEach((x) => n[x] === undefined && delete n[x]);
        mudar({ ao_entrar: Object.keys(n).length ? n : undefined });
    };
    const caixa = 'flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm';
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <label className={caixa}>
                    <Checkbox className="mt-0.5" checked={!!f.prazo_auto && !!f.prazo_dias} disabled={!f.prazo_dias}
                        onCheckedChange={(c) => mudar({ prazo_auto: c === true || undefined })} />
                    <span>Abrir o prazo da fase sozinho ao entrar{f.prazo_dias ? ` (${f.prazo_dias} dias)` : ''}
                        <span className="block text-xs text-slate-600 dark:text-slate-400">
                            {f.prazo_dias ? 'Encerra sozinho quando o processo sai da fase ou é arquivado. Vale para processos autuados depois de salvar.' : 'Informe primeiro os dias da fase, ao lado do nome.'}
                        </span>
                    </span>
                </label>
                {f.prazo_auto && f.prazo_dias > 0 && (
                    <div className="sm:max-w-xs pl-6">
                        <Label htmlFor={`pc-${f.id}`} className="text-xs">Contagem</Label>
                        <select id={`pc-${f.id}`} value={f.prazo_contagem || ''} onChange={(e) => mudar({ prazo_contagem: e.target.value || undefined })} className={`${campo} w-full`}>
                            <option value="">Dias úteis (com o calendário do órgão)</option>
                            <option value="corridos">Dias corridos</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="sm:max-w-md">
                <Label htmlFor={`np-${f.id}`} className="text-xs">Nome que as partes veem no portal</Label>
                <Input id={`np-${f.id}`} value={f.nome_publico || ''} maxLength={80} onChange={(e) => mudar({ nome_publico: e.target.value || undefined })}
                    placeholder={f.nome || `Fase ${i + 1}`} className="h-9" />
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Vazio: o nome da fase. Os termos nos autos usam sempre o nome oficial.</p>
            </div>
            <fieldset className="space-y-1">
                <legend className="text-xs font-medium mb-1">Ao entrar na fase</legend>
                <label className={caixa}><Checkbox className="mt-0.5" checked={!!ae.urgente} onCheckedChange={(c) => setAe('urgente', c === true)} />
                    <span>Marcar o processo como urgente</span></label>
                <label className={caixa}><Checkbox className="mt-0.5" checked={!!ae.sem_responsavel} onCheckedChange={(c) => setAe('sem_responsavel', c === true)} />
                    <span>Tirar o responsável designado <span className="block text-xs text-slate-600 dark:text-slate-400">A remessa a outra unidade já faz isso.</span></span></label>
                <p className="text-xs text-slate-600 dark:text-slate-400">O que a fase faz sozinha fica registrado nos eventos da equipe. As partes só veem a urgência, no termo da mudança.</p>
            </fieldset>
        </div>
    );
}

function Secao({ titulo, resumo, abertaDe = false, children }) {
    return (
        <details open={abertaDe} className="group rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <summary className="flex min-h-[2.75rem] sm:min-h-[2.25rem] cursor-pointer list-none items-center gap-2 px-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 rounded-md">
                <span>{titulo}</span>
                {resumo && <span className="min-w-0 truncate text-xs font-normal text-slate-600 dark:text-slate-300">{resumo}</span>}
                <ChevronDown className="ml-auto w-4 h-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 p-2.5">{children}</div>
        </details>
    );
}

function CartaoFase({
    f, i, total, fases, existentes, unidadesNovas, nomeModelo, modelos, mudar, mover, moverPara, remover, inserirAbaixo, duplicar, novaUnidade, addModelo,
    aberta, onAlternar, selecionada, pendente, unidadeNome, outrosEmTodas, ligadas,
}) {
    const [novoModelo, setNovoModelo] = useState('');
    const { paginas: paginasDoOrgao } = useContext(RegistroContexto);
    const outras = fases.filter((x) => x.id !== f.id);
    const saidas = f.proximas || [];
    const espera = ehEspera(fases, i);
    const origens = espera ? origensDaEspera(fases, f.id).map((id) => fases.find((x) => x.id === id)?.nome || '?') : [];
    const proxLista = fases.find((x, k) => k > i && !ehEspera(fases, k))?.nome || null;
    const setSaida = (k, id) => {
        const novas = [...saidas];
        const antiga = novas[k];
        novas[k] = id;
        const condicoes = { ...(f.condicoes || {}) };
        if (antiga && condicoes[antiga] !== undefined) { condicoes[id] = condicoes[antiga]; delete condicoes[antiga]; }
        // A regra pela resposta acompanha a saída que mudou de destino.
        const regra = { ...(f.condicoes_regra || {}) };
        if (antiga && regra[antiga]) { regra[id] = regra[antiga]; delete regra[antiga]; }
        mudar({ proximas: [...new Set(novas.filter(Boolean))], condicoes, condicoes_regra: Object.keys(regra).length ? regra : undefined });
    };
    const tirarSaida = (id) => {
        const { [id]: _c, ...cond } = f.condicoes || {};
        const { [id]: _r, ...regra } = f.condicoes_regra || {};
        mudar({ proximas: saidas.filter((x) => x !== id), condicoes: cond, condicoes_regra: Object.keys(regra).length ? regra : undefined });
    };
    const setRegraSaida = (id, c) => {
        const regra = { ...(f.condicoes_regra || {}) };
        if (c) regra[id] = c; else delete regra[id];
        mudar({ condicoes_regra: Object.keys(regra).length ? regra : undefined });
    };
    const nomeDe = (id) => fases.find((x) => x.id === id)?.nome || '?';
    const nAcoes = (f.acoes || []).filter((a) => a.trim()).length;
    const resumo = f.final ? 'Fim do processo' : espera ? 'Espera: volta à fase de origem' : saidas.length > 1 ? `${saidas.length} saídas` : saidas.length === 1 ? `→ ${nomeDe(saidas[0])}` : proxLista ? `→ ${proxLista}` : 'Sem saída';
    const nDocs = (f.documentos || []).length;
    const nModelos = (f.modelos_ref || []).length;
    const rotulo = f.nome.trim() || `fase ${i + 1}`;
    return (
        <ItemOrdenavel id={f.id} rotulo={`Arrastar a fase ${rotulo}`}
            // Fase aberta: fundo e borda próprios, para ver onde os dados dela começam e terminam.
            className={`rounded-lg border scroll-mt-4 ${aberta ? 'bg-indigo-50 dark:bg-indigo-950/40 border-l-4' : 'bg-white dark:bg-slate-900'} ${selecionada ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : aberta ? 'border-indigo-300 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'}`}>
        {({ alca }) => (
        <div id={`fase-${f.id}`} className="scroll-mt-4">
            <div className="flex items-center gap-0.5 pl-1 pr-1">
            {alca}
            <button type="button" onClick={onAlternar} aria-expanded={aberta} aria-controls={`fase-corpo-${f.id}`}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2.5 pl-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${aberta ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${f.nome.trim() ? '' : 'text-red-700 dark:text-red-300'}`}>{f.nome.trim() || 'Fase sem nome'}</span>
                    <span className="block truncate text-xs text-slate-600 dark:text-slate-300">
                        {[unidadeNome || 'Sem unidade', f.prazo_dias ? `${f.prazo_dias} dias` : '', nAcoes ? `${nAcoes} ${nAcoes > 1 ? 'ações' : 'ação'}` : '', resumo].filter(Boolean).join(' · ')}
                    </span>
                </span>
                {pendente && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" aria-label="Tem pendência" />}
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${aberta ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className={`${ICONE} shrink-0`} aria-label={`Mais ações da fase ${rotulo}`}><MoreVertical className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={inserirAbaixo}><ListPlus className="w-4 h-4 mr-2" aria-hidden /> Inserir fase abaixo</DropdownMenuItem>
                    <DropdownMenuItem onSelect={duplicar}><CopyPlus className="w-4 h-4 mr-2" aria-hidden /> Duplicar fase</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={i === 0} onSelect={() => moverPara(0)}><ChevronsUp className="w-4 h-4 mr-2" aria-hidden /> Mover para o início</DropdownMenuItem>
                    <DropdownMenuItem disabled={i === 0} onSelect={() => mover(-1)}><ArrowUp className="w-4 h-4 mr-2" aria-hidden /> Subir uma posição</DropdownMenuItem>
                    <DropdownMenuItem disabled={i === total - 1} onSelect={() => mover(1)}><ArrowDown className="w-4 h-4 mr-2" aria-hidden /> Descer uma posição</DropdownMenuItem>
                    <DropdownMenuItem disabled={i === total - 1} onSelect={() => moverPara(total - 1)}><ChevronsDown className="w-4 h-4 mr-2" aria-hidden /> Mover para o fim</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={total === 1} onSelect={remover} className="text-red-700 dark:text-red-300"><Trash2 className="w-4 h-4 mr-2" aria-hidden /> Remover fase</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </div>
            {aberta && (
            <div id={`fase-corpo-${f.id}`} className="space-y-3 border-t border-indigo-200 dark:border-indigo-800 p-3 [&_input:not([type=checkbox])]:bg-white [&_select]:bg-white [&_textarea]:bg-white dark:[&_input:not([type=checkbox])]:bg-slate-900 dark:[&_select]:bg-slate-900 dark:[&_textarea]:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2">
                <Input id={`nome-${f.id}`} aria-label={`Nome da fase ${i + 1}`} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Nome da fase" className="h-9 flex-1 min-w-[10rem] font-medium" />
                <Input aria-label={`Prazo da fase ${i + 1}, em dias`} type="number" min={1} max={3650} placeholder="Dias" value={f.prazo_dias || ''} onChange={(e) => mudar({ prazo_dias: Number(e.target.value) || undefined })} className="h-9 w-20" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <Label htmlFor={`un-${f.id}`} className="text-xs">Unidade</Label>
                    <select id={`un-${f.id}`} value={f.unidade_ref || ''} onChange={(e) => (e.target.value === '__nova' ? novaUnidade() : mudar({ unidade_ref: e.target.value || null }))} className={`${campo} w-full`}>
                        <option value="">Sem unidade definida</option>
                        {existentes.length > 0 && <optgroup label="Do órgão">{existentes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</optgroup>}
                        {unidadesNovas.length > 0 && <optgroup label="Novas (serão criadas)">{unidadesNovas.map((u) => <option key={u.ref} value={u.ref}>{u.nome}</option>)}</optgroup>}
                        <option value="__nova">+ Nova unidade…</option>
                    </select>
                </div>
                <div>
                    <Label htmlFor={`ag-${f.id}`} className="text-xs">Quem faz (cargo ou papel)</Label>
                    <Input id={`ag-${f.id}`} value={f.agente || ''} onChange={(e) => mudar({ agente: e.target.value })} placeholder="Ex.: Analista, Promotor" className="h-9" />
                </div>
            </div>
            <Secao titulo="Prazo, nome para as partes e ao entrar" resumo={resumoEntrada(f)}>
                <AoEntrarNaFase f={f} i={i} mudar={mudar} />
            </Secao>
            <AcoesDaFase f={f} modelos={modelos} mudar={mudar} idBase={`pr-${f.id}`} />
            <Secao titulo="Andamento automático" resumo={resumoAndamento(f, paginasDoOrgao).join('; ') || 'a fase só anda pelo botão'}>
                <AndamentoDaFase f={f} mudar={mudar} ligadas={ligadas} />
            </Secao>
            <Secao titulo="Registros, certidão conjunta e documentos" resumo={nDocs ? plural(nDocs, 'documento pedido', 'documentos pedidos') : 'onde fica cada ato da fase'}>
                <RegistroEDocumentos f={f} fases={fases} modelos={modelos} mudar={mudar} aplicarATodas={outrosEmTodas} />
            </Secao>
            <div>
                <p className="text-xs font-medium mb-1">Modelos de documento{nModelos > MAX_MODELOS_FASE ? ` (${nModelos}; cabem ${MAX_MODELOS_FASE})` : ''}</p>
                <div className="flex flex-wrap gap-1.5 items-center">
                    {(f.modelos_ref || []).map((r) => (
                        <Badge key={r} variant={String(r).startsWith('+') ? 'outline' : 'secondary'} className="gap-1 py-0 sm:py-0.5">
                            {nomeModelo(r)}{String(r).startsWith('+') && <span className="text-[10px] text-indigo-600">novo</span>}
                            <button type="button" className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center sm:-m-1.5 sm:h-auto sm:w-auto sm:p-1.5" onClick={() => mudar({ modelos_ref: f.modelos_ref.filter((x) => x !== r) })} aria-label={`Tirar ${nomeModelo(r)}`}><X className="w-3 h-3" /></button>
                        </Badge>
                    ))}
                    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); addModelo(novoModelo); setNovoModelo(''); }}>
                        <Input aria-label="Adicionar modelo pelo nome" value={novoModelo} onChange={(e) => setNovoModelo(e.target.value)} placeholder="+ modelo" className="h-7 w-36 text-xs" />
                    </form>
                </div>
            </div>
            <fieldset>
                <legend className="text-xs font-medium mb-1">Encaminhamentos</legend>
                <label className="flex items-center gap-2 text-sm mb-2"><Checkbox checked={!!f.final} onCheckedChange={(c) => mudar({ final: c === true })} /> O processo termina nesta fase</label>
                {i > 0 && !f.final && (
                    <label className="flex items-start gap-2 text-sm mb-2">
                        <Checkbox className="mt-0.5" checked={!!f.espera}
                            onCheckedChange={(c) => mudar(c === true ? { espera: true, proximas: [], condicoes: {}, condicoes_regra: undefined } : { espera: undefined })} />
                        <span>Fase de espera (ex.: diligência externa)
                            <span className="block text-xs text-slate-600 dark:text-slate-400">O processo entra nela vindo de outra fase, aguarda e volta para a fase de onde veio, que é retomada como estava.</span>
                        </span>
                    </label>
                )}
                {espera && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        {origens.length
                            ? `Entra-se nela por ${origens.join(', ')}. Ao concluir, o processo volta para a fase de onde veio.`
                            : 'Nenhuma fase leva a esta ainda. Na fase de origem (ex.: Análise), em Encaminhamentos, acrescente esta como alternativa.'}
                    </p>
                )}
                {!f.final && !espera && (
                    <div className="space-y-1.5">
                        {saidas.length === 0 && <p className="text-xs text-slate-600">{proxLista ? `Segue para a próxima da lista (${proxLista}).` : 'Última fase.'}</p>}
                        {saidas.map((id, k) => (
                            <div key={`${id}-${k}`} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-2">
                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="text-xs text-slate-600">→</span>
                                    <select aria-label="Próxima fase" value={id} onChange={(e) => setSaida(k, e.target.value)} className={`${campo} h-8 flex-1 min-w-[9rem]`}>
                                        {outras.map((x) => <option key={x.id} value={x.id}>{x.nome || '(sem nome)'}{ehEspera(fases, fases.indexOf(x)) ? ' (espera)' : ''}</option>)}
                                    </select>
                                    <Input aria-label="Condição desta saída" value={f.condicoes?.[id] || ''} onChange={(e) => mudar({ condicoes: { ...(f.condicoes || {}), [id]: e.target.value } })} placeholder="Condição (ex.: se deferido)" className="h-8 flex-1 min-w-[9rem]" />
                                    <Button size="icon" variant="ghost" className={ICONE} onClick={() => tirarSaida(id)} aria-label="Tirar esta saída"><X className="w-4 h-4" /></Button>
                                </div>
                                {/* Regra que vale: a resposta de uma ação de escolha indica esta saída; seguir por ela sem a resposta pede motivo. */}
                                <CondicaoPorResposta id={`cr-${f.id}-${k}`} f={f} valor={f.condicoes_regra?.[id]} rotulo="Regra desta saída" vazio="Sem regra: a equipe escolhe"
                                    onChange={(c) => setRegraSaida(id, c)} />
                                {f.condicoes_regra?.[id]?.valores.length > 0 && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Indicada quando {textoCondicao(f, f.condicoes_regra[id])}. Seguir por ela sem essa resposta exige motivo.</p>
                                )}
                            </div>
                        ))}
                        {outras.length > 0 && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => {
                                const livre = outras.find((x) => !saidas.includes(x.id) && x.id === fases[i + 1]?.id) || outras.find((x) => !saidas.includes(x.id));
                                if (livre) mudar({ proximas: [...saidas, livre.id] });
                            }}><Plus className="w-3.5 h-3.5" /> Alternativa</Button>
                        )}
                    </div>
                )}
            </fieldset>
            <div>
                <Label htmlFor={`or-${f.id}`} className="text-xs">Orientação para a equipe</Label>
                <Textarea id={`or-${f.id}`} rows={2} value={f.orientacao || ''} onChange={(e) => mudar({ orientacao: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 border-t border-indigo-200 dark:border-indigo-800 pt-2 text-xs text-indigo-900 dark:text-indigo-200">
                <span className="min-w-0 flex-1 truncate">Fim da fase {i + 1}: {rotulo}</span>
                <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onAlternar}><ChevronDown className="w-3.5 h-3.5 rotate-180" aria-hidden /> Recolher</Button>
            </div>
            </div>
            )}
        </div>
        )}
        </ItemOrdenavel>
    );
}
