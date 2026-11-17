import React, { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AREAS, bibliotecaDeModelos, nomePorte } from '@/lib/bibliotecaRitos';

// Guia prático de implantação: do mapeamento do processo do órgão até pôr em
// uso. Complementa o Guia do rito (que explica o editor) e a biblioteca de
// modelos (o ponto de partida). Texto igual ao de docs/GUIA_IMPLANTACAO.md.

function Parte({ titulo, children, aberta = false }) {
    return (
        <details open={aberta} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</summary>
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-700 dark:text-slate-200">{children}</div>
        </details>
    );
}

const tabela = 'w-full text-left text-sm [&_td]:border-t [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-slate-600 dark:[&_th]:text-slate-300';

/** Ordem de configuração: [aba, título, o que fazer]. */
export const PASSOS_IMPLANTACAO = [
    ['estrutura', 'Estrutura', 'Se o órgão tem órgãos internos (promotorias, departamentos), crie-os. Cada um pode ter tipos de processo próprios.'],
    ['unidades', 'Unidades e equipes', 'Uma unidade para cada lugar por onde o processo passa: quem protocola, quem instrui, quem decide, quem assessora, quem julga em colegiado. Lote as pessoas e dê a cada uma o papel (gere ou atua) e a atribuição (ex.: Presidente da comissão, Pregoeiro, Fiscal do contrato). As atribuições servem para reservar atos e designar responsáveis no rito.'],
    ['ritos', 'Rito', 'Em Novo rito, comece de um modelo da biblioteca, de um arquivo (planilha, Word, PDF, Bizagi, BPMN), do pacote exportado por outro órgão ou em branco. Troque as unidades genéricas pelas do órgão e confira prazos e contagem com a norma local.'],
    ['tipos', 'Tipo de processo', 'O tipo liga o rito ao "Novo processo": formulário (campos, partes e nomes dos polos), numeração (com siglas ou com os códigos numéricos de cada tipo, unidade e órgão interno, dados no botão Códigos), sigilo padrão, unidade de entrada, de onde o processo pode nascer e o registro que a autuação cria numa página própria. Um rito pode servir a vários tipos.'],
    ['documentos', 'Documentos e modelos', 'Papel timbrado e um modelo de texto para cada peça que o rito manda redigir (portaria, despacho, decisão, ata, relatório), com o mesmo tipo de documento que a ação pede: assim a equipe já começa do texto do órgão.'],
    ['listas', 'Listas do órgão (se precisar)', 'Espécies de comunicação e de audiência e origens do processo que o órgão usa e o sistema não traz (edital, sessão de mediação, ouvidoria). Entram na autuação, nas ações do rito e nas condições.'],
    ['calendario', 'Calendário', 'Feriados e pontos facultativos do órgão: os prazos em dias úteis pulam esses dias.'],
    ['preferencias', 'Preferências', 'Se a petição da parte interrompe a fase e em quantos dias a comunicação não aberta é dada por ciente.'],
];

export default function GuiaImplantacao({ onIr, variante = 'outline', className = '' }) {
    const [aberto, setAberto] = useState(false);
    const modelos = useMemo(() => (aberto ? bibliotecaDeModelos() : []), [aberto]);
    const ir = (aba) => { setAberto(false); onIr?.(aba); };
    return (
        <>
            <Button type="button" variant={variante} className={`gap-2 ${className}`} onClick={() => setAberto(true)}>
                <Compass className="w-4 h-4" aria-hidden /> Guia de implantação
            </Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Guia de implantação</DialogTitle>
                        <DialogDescription>Como montar, na prática, o processo eletrônico do seu órgão: do mapeamento do processo real até pôr em uso e ajustar.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Parte titulo="1. Antes de configurar: mapeie o processo real" aberta>
                            <p>Reúna quem trabalha no processo hoje e responda, por escrito:</p>
                            <ol className="list-decimal space-y-1 pl-5">
                                <li><strong>Quem começa</strong> o processo (protocolo, um setor, o cidadão pelo portal, de ofício) e com quais documentos?</li>
                                <li><strong>Por onde ele passa</strong>, em ordem, e quem faz o quê em cada lugar? Cada lugar vira uma fase; cada pessoa ou setor, uma unidade.</li>
                                <li><strong>Quem decide</strong>, e há mais de uma instância (reconsideração, recurso, colegiado)?</li>
                                <li><strong>Há partes de fora</strong> (requerente, acusado, licitante, contratada)? Elas precisam ser ouvidas, intimadas, ter prazo?</li>
                                <li><strong>Pode resultar em sanção?</strong> Então há contraditório e ampla defesa (parte 4) e separação entre quem instrui e quem julga.</li>
                                <li><strong>Quais prazos a norma fixa</strong>, contados em dias úteis ou corridos, e a partir de quê?</li>
                                <li><strong>Quais peças são obrigatórias</strong> (portaria, notificação, defesa, relatório, decisão, ata)?</li>
                                <li><strong>Há sigilo</strong> em alguma etapa (instrução disciplinar, dado pessoal, saúde)?</li>
                                <li><strong>Onde o caminho se divide</strong>: deferido ou indeferido, defesa apresentada ou não, recurso ou não?</li>
                            </ol>
                            <p>Com essas respostas, o rito quase se escreve sozinho: fases e unidades (2), ações e documentos (7), prazos (6), desvios (9), partes e comunicações (4 e 5).</p>
                        </Parte>
                        <Parte titulo="2. Escolha o ponto de partida">
                            <p>Quase sempre há um modelo próximo na <strong>Biblioteca de modelos de processo</strong> (em Ritos, Novo rito). Comece pelo mais parecido e ajuste: é mais rápido e traz as garantias que a lei exige. Se nenhum servir, use o <strong>Processo administrativo com interessado</strong> (Lei 9.784, o rito subsidiário), importe o fluxo que o órgão já tem (planilha, Word, PDF, Bizagi, BPMN), traga o rito pronto de outro órgão (em Ritos, <strong>Importar de outro órgão</strong>, com o arquivo que ele exportou) ou comece em branco. Os modelos da biblioteca são da plataforma: usar um cria uma cópia só do seu órgão, que mudanças na biblioteca não alteram.</p>
                            <table className={tabela}>
                                <thead><tr><th>Área</th><th>Modelos (porte)</th></tr></thead>
                                <tbody>
                                    {AREAS.map(([a, nome]) => {
                                        const da = modelos.filter((m) => m.area === a);
                                        return da.length ? <tr key={a}><td>{nome}</td><td>{da.map((m) => `${m.nome} (${nomePorte(m.porte).toLowerCase()})`).join('; ')}</td></tr> : null;
                                    })}
                                </tbody>
                            </table>
                            <p><strong>Curto</strong>: decisão rápida, pouca instrução. <strong>Médio</strong>: instrução, manifestação da parte, decisão e recurso. <strong>Longo</strong>: comissão, audiências, defesa escrita, relatório, julgamento e instâncias.</p>
                        </Parte>
                        <Parte titulo="3. Configure nesta ordem">
                            <ol className="space-y-2">
                                {PASSOS_IMPLANTACAO.map(([aba, titulo, texto], i) => (
                                    <li key={aba} className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0"><strong>{i + 1}. {titulo}.</strong> {texto}</div>
                                        {onIr && <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => ir(aba)} aria-label={`Abrir ${titulo}`}>Abrir</Button>}
                                    </li>
                                ))}
                            </ol>
                        </Parte>
                        <Parte titulo="4. Processo com partes: contraditório e ampla defesa">
                            <p>Quando alguém de fora pode ser atingido pela decisão, o rito precisa garantir cada item abaixo. A coluna da direita diz como.</p>
                            <table className={tabela}>
                                <thead><tr><th>Garantia</th><th>Como o rito garante</th></tr></thead>
                                <tbody>
                                    <tr><td>Saber que o processo existe e do que se trata</td><td>Ação <strong>Comunicar as partes</strong> com espécie citação ou notificação, ao polo certo, com texto que diga o fato e o enquadramento. Cada comunicação vira certidão nos autos.</td></tr>
                                    <tr><td>Prazo para se defender</td><td>A comunicação com <strong>prazo</strong> (úteis ou corridos) e, logo depois, <strong>Esperar a resposta das partes</strong>. O prazo conta da ciência; sem resposta, o sistema certifica o decurso.</td></tr>
                                    <tr><td>Ver os autos</td><td>O <strong>portal das partes</strong> mostra os autos públicos e cada comunicação. O que é interno (dados reservados, impressão interna, pendências) nunca vai à parte.</td></tr>
                                    <tr><td>Produzir provas</td><td><strong>Designar audiência ou sessão</strong> (oitiva, instrução, inspeção) com intimação que traga {'{audiencia}'} no texto; a parte também junta documentos pelo portal.</td></tr>
                                    <tr><td>Defesa quando a parte se cala</td><td>Saída da fase pela resposta <strong>Sem manifestação</strong> para uma fase de revelia ou de defensor dativo, com novo prazo.</td></tr>
                                    <tr><td>Decisão motivada</td><td>Documento <strong>Decisão</strong> obrigatório na fase de julgamento e, se houver comissão, <strong>Relatório</strong> antes dele.</td></tr>
                                    <tr><td>Recorrer</td><td>Comunicar a decisão com o prazo do recurso, esperar a resposta e sair por ela: recurso apresentado vai à instância recursal; sem recurso, ao cumprimento.</td></tr>
                                    <tr><td>Justa causa no prazo</td><td>Na tela do processo, <strong>Prorrogar</strong> (enquanto corre) ou <strong>Devolver</strong> (depois de vencido), sempre com motivo e certidão.</td></tr>
                                    <tr><td>Nome de cada parte</td><td>No tipo de processo, dê nome aos polos (Denunciante, Acusado, Contratada): aparece em certidões, comunicações e no portal.</td></tr>
                                </tbody>
                            </table>
                        </Parte>
                        <Parte titulo="5. Processo sancionador: cuidados a mais">
                            <ul className="list-disc space-y-1 pl-5">
                                <li><strong>Nunca penal.</strong> O SIGO modela processos administrativos. Quando o fato também pode ter outra natureza, o rito registra a <strong>remessa a outros órgãos</strong> e segue no que é administrativo.</li>
                                <li><strong>Quem instrui não julga.</strong> Ponha instrução e julgamento em unidades diferentes (Comissão processante e Gabinete) e reserve a conclusão da fase de julgamento a quem tem a atribuição, em <strong>Quem pode nesta fase</strong>.</li>
                                <li><strong>Acusação clara.</strong> A portaria ou o termo de indiciação descreve o fato e o enquadramento; a defesa responde a ele. Exija esses documentos nas fases certas.</li>
                                <li><strong>Prescrição e prazos de conclusão.</strong> Registre em formulário as datas que contam (ciência do fato, instauração, interrupções) e use o prazo automático da fase para o prazo de conclusão.</li>
                                <li><strong>Dosimetria.</strong> Um formulário com a sanção escolhida, agravantes e atenuantes deixa a proporcionalidade à vista de quem revisa.</li>
                                <li><strong>Sigilo na instrução.</strong> Em <strong>Ao entrar</strong>, torne o processo restrito na instrução e devolva ao normal no julgamento, se a norma pedir.</li>
                            </ul>
                        </Parte>
                        <Parte titulo="6. Processo interno, sem partes">
                            <p>Consultas, pareceres, pedidos entre setores: não marque polos no tipo. Use <strong>fases de espera</strong> para diligências fora do órgão, <strong>andamento automático</strong> para a fase seguir quando o que ela exige estiver cumprido e <strong>pendência para quem decide</strong> para levar o processo ao gabinete. O Rito Consultas CAOCIPP, no Guia do rito, é um exemplo completo.</p>
                        </Parte>
                        <Parte titulo="7. Julgamento em colegiado e a primeira sessão">
                            <p>Quando a decisão é de um conselho, comissão, junta ou câmara, o processo vai a julgamento em sessão, com pauta, relator, votos, vista, acórdão e ata.</p>
                            <ol className="list-decimal space-y-1 pl-5">
                                <li>Em <strong>Estrutura</strong>, cadastre o órgão com <strong>decisão colegiada</strong> e a composição: presidente, titulares e suplentes, com o período de cada um. Ajuste a antecedência da pauta, o prazo de vista e o do acórdão, se o regimento disser.</li>
                                <li>Em <strong>Unidades e equipes</strong>, crie ao menos uma unidade do colegiado, de preferência a secretaria que expede. Só entram na pauta processos que estão numa unidade dele.</li>
                                <li>No rito, use na fase de julgamento a ação <strong>Julgar em colegiado</strong>, com os resultados possíveis. Na biblioteca, o filtro <strong>Usa</strong> mostra os modelos que já trazem a ação.</li>
                                <li>Na aba <strong>Sessões</strong>, a secretaria segue o guia do colegiado: marca a sessão, inclui os processos com julgamento pendente, publica a pauta e, no dia, registra a presença, colhe os votos e proclama. Ao encerrar, o sistema gera a ata.</li>
                                <li>O <strong>Relatório do colegiado</strong>, na mesma aba, mostra por período os julgados por resultado e por relator, o que saiu da pauta, as vistas em atraso e o tempo médio até o acórdão, com download em CSV ou Excel.</li>
                            </ol>
                        </Parte>
                        <Parte titulo="8. Teste antes de pôr em uso">
                            <ol className="list-decimal space-y-1 pl-5">
                                <li>No editor, resolva todas as <strong>pendências</strong> e abra a <strong>Prévia</strong>: ela mostra como a equipe e as partes vão ver cada fase.</li>
                                <li>Use <strong>Ver como a equipe e a parte</strong> para conferir as telas de cada papel.</li>
                                <li>Autue um <strong>processo de teste</strong> com uma parte de teste (um e-mail seu) e leve-o do começo ao fim, por todos os desvios importantes. Exclua-o depois.</li>
                                <li>Confira as certidões nos autos e o que a parte viu no portal.</li>
                            </ol>
                        </Parte>
                        <Parte titulo="9. Em uso: ajuste sem medo">
                            <p>Cada vez que o rito é salvo vira uma nova <strong>versão</strong>. Processos já autuados seguem com a cópia do rito da autuação (e com os nomes de polos daquela época), então ajustar não bagunça o que está em curso. O histórico da configuração registra quem mudou o quê. Reveja o rito depois dos primeiros processos reais: onde a equipe trava, falta uma ação, um documento ou um desvio.</p>
                        </Parte>
                        <Parte titulo="10. Lista final antes de ativar">
                            <ul className="list-disc space-y-1 pl-5">
                                <li>Toda fase tem unidade, e toda unidade tem pelo menos uma pessoa lotada.</li>
                                <li>Prazos e contagem conferidos com a norma do órgão, inclusive feriados no calendário.</li>
                                <li>Com partes: citação ou notificação com prazo, espera da defesa, decisão comunicada, prazo de recurso.</li>
                                <li>Documentos obrigatórios marcados e com modelo de texto.</li>
                                <li>Tipo de processo com o formulário, os polos e a unidade de entrada.</li>
                                <li>Um processo de teste levado até o fim.</li>
                            </ul>
                        </Parte>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
