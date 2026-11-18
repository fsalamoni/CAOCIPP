/**
 * Biblioteca de modelos de rito: processos completos, por área e porte, com
 * descrição explicativa, quando usar e base normativa. A forma de escrever um
 * modelo está em ./modelos/dsl.js; cada área tem o seu arquivo.
 */
import { modelos as geral } from './modelos/geral.js';
import { modelos as correcional } from './modelos/correcional.js';
import { modelos as etica } from './modelos/etica.js';
import { modelos as sancionador } from './modelos/sancionador.js';
import { modelos as contratacoes } from './modelos/contratacoes.js';
import { modelos as contratos } from './modelos/contratos.js';
import { modelos as atendimento } from './modelos/atendimento.js';
import { modelos as ministerio_publico } from './modelos/ministerio_publico.js';
import { modelos as conselhos } from './modelos/conselhos.js';
import { modelos as mp_extrajudicial } from './modelos/mp_extrajudicial.js';
import { modelos as uniao } from './modelos/uniao.js';
import { modelos as colegiados } from './modelos/colegiados.js';
import { modelos as gestaoContratual } from './modelos/gestao_contratual.js';
import { modelos as patrimonio } from './modelos/patrimonio.js';
import { modelos as mprs } from './modelos/mprs_administrativo.js';
import { modelos as esferas } from './modelos/esferas.js';
import { modelos as improbidade } from './modelos/improbidade.js';

export { A, AREAS, PORTES, montar, nomeArea, nomePorte, quando } from './modelos/dsl.js';

/** Funções dos modelos, na ordem em que aparecem (cada chamada gera ids novos). */
export const MODELOS = [...geral, ...correcional, ...etica, ...sancionador, ...contratacoes, ...gestaoContratual, ...contratos, ...atendimento, ...ministerio_publico, ...conselhos, ...mp_extrajudicial, ...improbidade, ...uniao, ...colegiados, ...patrimonio, ...mprs, ...esferas];

/**
 * Nome do painel e da planilha de acompanhamento que cada modelo propõe
 * ([um registro, o painel]). Todo modelo tem o seu: quem implanta decide, na
 * revisão do rito, se cria o painel ou segue sem ele.
 */
export const PAINEIS = {
    'pa-geral': ['Processo administrativo', 'Processos administrativos'],
    'sindicancia-investigativa': ['Sindicância', 'Sindicâncias'],
    'pad-ordinario': ['Processo disciplinar', 'Processos disciplinares'],
    'pad-sumario': ['Processo disciplinar sumário', 'Processos disciplinares sumários'],
    'tac-disciplinar': ['Termo de ajustamento', 'Termos de ajustamento de conduta'],
    'etico-profissional': ['Processo ético', 'Processos éticos'],
    'disciplinar-entidade-classe': ['Processo disciplinar', 'Processos disciplinares'],
    'comissao-etica-publica': ['Apuração ética', 'Apurações éticas'],
    'par-pessoa-juridica': ['Processo de responsabilização', 'Processos de responsabilização'],
    'sancao-fornecedor': ['Apuração de fornecedor', 'Apurações de fornecedores'],
    'auto-de-infracao': ['Auto de infração', 'Autos de infração'],
    'processo-fiscal': ['Processo fiscal', 'Processos fiscais'],
    'multa-transito': ['Autuação de trânsito', 'Autuações de trânsito'],
    licitacao: ['Licitação', 'Licitações'],
    'contratacao-direta': ['Contratação direta', 'Contratações diretas'],
    'compra-privada': ['Compra', 'Compras'],
    'gestao-contratual-completa': ['Contrato', 'Contratos'],
    'gestao-contrato': ['Contrato', 'Contratos'],
    'recebimento-pagamento': ['Pagamento', 'Pagamentos'],
    'parceria-osc': ['Parceria', 'Parcerias com OSC'],
    ouvidoria: ['Manifestação', 'Manifestações de ouvidoria'],
    'acesso-informacao': ['Pedido de informação', 'Pedidos de acesso à informação'],
    'tomada-contas-especial': ['Tomada de contas', 'Tomadas de contas especiais'],
    'consulta-interna': ['Consulta', 'Consultas internas'],
    'beneficio-servidor': ['Requerimento', 'Requerimentos de servidores'],
    'noticia-de-fato': ['Notícia de fato', 'Notícias de fato'],
    'procedimento-administrativo-mp': ['Procedimento administrativo', 'Procedimentos administrativos'],
    'procedimento-preparatorio': ['Procedimento preparatório', 'Procedimentos preparatórios'],
    'inquerito-civil': ['Inquérito civil', 'Inquéritos civis'],
    'ted-oab-rs': ['Processo ético-disciplinar', 'Processos ético-disciplinares'],
    'revisao-disciplinar-oab': ['Revisão disciplinar', 'Revisões disciplinares'],
    'reabilitacao-oab': ['Reabilitação', 'Reabilitações'],
    'etico-disciplinar-cau': ['Processo ético-disciplinar', 'Processos ético-disciplinares'],
    'fiscalizacao-cau': ['Fiscalização', 'Fiscalizações'],
    'compromisso-ajustamento-conduta': ['Compromisso de ajustamento', 'Compromissos de ajustamento de conduta'],
    'recomendacao-mp': ['Recomendação', 'Recomendações'],
    'audiencia-publica-mp': ['Audiência pública', 'Audiências públicas'],
    'revisao-arquivamento-csmp': ['Revisão de arquivamento', 'Revisões de arquivamento'],
    'destinacao-bens-valores-mprs': ['Destinação', 'Destinações de bens e valores'],
    'cadastro-entidade-mprs': ['Entidade', 'Entidades cadastradas'],
    'triagem-patrimonio-publico-mprs': ['Representação', 'Triagem de representações'],
    'correicao-corregedoria-mp': ['Correição', 'Correições'],
    'conciliacao-ccaf': ['Conciliação', 'Conciliações'],
    'acordo-transacao-uniao': ['Acordo', 'Acordos e transações'],
    'cobranca-divida-ativa-nao-tributaria': ['Crédito', 'Créditos em cobrança'],
    'acordo-leniencia': ['Acordo de leniência', 'Acordos de leniência'],
    'sindicancia-patrimonial': ['Sindicância patrimonial', 'Sindicâncias patrimoniais'],
    'juizo-admissibilidade-correcional': ['Admissibilidade', 'Juízos de admissibilidade'],
    'processo-disciplinar-empregado-publico': ['Processo disciplinar', 'Processos disciplinares'],
    'recurso-colegiado': ['Recurso', 'Recursos'],
    'deliberacao-normativa': ['Deliberação', 'Deliberações'],
    'gestao-patrimonio': ['Bem', 'Bens patrimoniais'],
    'gestao-contratual-mprs': ['Contrato', 'Contratos'],
    'descumprimento-contratual-mprs': ['Descumprimento contratual', 'Descumprimentos contratuais'],
    'gestao-patrimonio-mprs': ['Bem móvel', 'Bens móveis'],
    'sancao-fornecedor-rs': ['Apuração de fornecedor', 'Apurações de fornecedores'],
    'bens-inserviveis-rs': ['Lote de inservíveis', 'Bens inservíveis'],
    'bens-inserviveis-federal': ['Lote de inservíveis', 'Bens inservíveis'],
    'inquerito-civil-improbidade-mprs': ['Inquérito de improbidade', 'Inquéritos de improbidade'],
    'anpc-tratativas-mprs': ['Tratativa de acordo', 'Tratativas de acordo'],
    'anpc-acompanhamento-mprs': ['Acordo em acompanhamento', 'Acordos em acompanhamento'],
    'anpc-completo-mprs': ['Acordo de não persecução', 'Acordos de não persecução civil'],
};

export function bibliotecaDeModelos() {
    return MODELOS.map((m) => m()).map((m) => ({ ...m, painel: PAINEIS[m.id] }));
}
