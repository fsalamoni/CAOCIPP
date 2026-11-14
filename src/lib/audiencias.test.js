import test from 'node:test';
import assert from 'node:assert/strict';
import { audienciasFuturas, comAudiencia, textoDaAudiencia } from './audiencias.js';
import { partesVeem, pedeDado, regraComPedido, resumoDaAcao } from './exigencias.js';

const aud = (data, hora, extra = {}) => ({ id: data + hora, especie: 'instrucao', data, hora, modo: 'presencial', local: 'Sala 3', status: 'designada', ...extra });

test('audiência na tela: texto igual ao do servidor, a próxima e a troca de {audiencia}', () => {
    assert.equal(textoDaAudiencia({ data: '2026-11-20', hora: '14:00', modo: 'hibrida', local: 'Sala 3', link: 'L', participantes: [{ nome: 'José', qualidade: 'perito' }] }),
        '20/11/2026, às 14:00, em Sala 3 e por videoconferência (L). Participam, além das partes: José (perito)');
    const lista = [aud('2026-11-25', '10:00'), aud('2026-11-20', '14:00'), aud('2026-11-18', '09:00', { status: 'cancelada' }), aud('2026-11-01', '09:00')];
    assert.deepEqual(audienciasFuturas(lista, '2026-11-14').map((a) => a.id), ['2026-11-2014:00', '2026-11-2510:00']);
    assert.equal(comAudiencia('Compareça em {audiencia}.', lista, '2026-11-14'), 'Compareça em 20/11/2026, às 14:00, em Sala 3.');
    assert.equal(comAudiencia('Compareça em {audiencia}.', [], '2026-11-14'), 'Compareça em {audiencia}.', 'sem audiência a marca fica (a tela e o servidor apontam)');
});

test('editor: designar audiência vai aos autos, as partes veem e não é dado de folha', () => {
    const r = regraComPedido({ obrigatoria: true, quem: 'gestor', folha_dados: true, ve: 'gestor' }, 'audiencia', 'Designar');
    assert.deepEqual(r, { pede: 'audiencia', audiencia: { especie: 'audiencia' }, destino: 'autos', partes: true, obrigatoria: true, quem: 'gestor' });
    assert.equal(partesVeem(r), true);
    assert.equal(pedeDado(r), false);
    assert.equal(resumoDaAcao({ ...r, audiencia: { especie: 'instrucao' } }), 'designa audiência de instrução; certidão nos autos; partes veem; obrigatória; só quem gere a unidade');
});
