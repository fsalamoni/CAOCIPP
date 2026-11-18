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

export { A, AREAS, PORTES, montar, nomeArea, nomePorte, quando } from './modelos/dsl.js';

/** Funções dos modelos, na ordem em que aparecem (cada chamada gera ids novos). */
export const MODELOS = [...geral, ...correcional, ...etica, ...sancionador, ...contratacoes, ...gestaoContratual, ...contratos, ...atendimento, ...ministerio_publico, ...conselhos, ...mp_extrajudicial, ...uniao, ...colegiados, ...patrimonio];

export function bibliotecaDeModelos() {
    return MODELOS.map((m) => m());
}
