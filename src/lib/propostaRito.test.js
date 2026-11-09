// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
    propostaDeBpmn, propostaDeConteudo, propostaDeDrawio, propostaDeMermaid, propostaDeTabela, propostaDeTexto, tipoProvavel, vincularProposta,
} from './propostaRito.js';
import { seguintes } from './secretariaRito.js';

const por = (fases, nome) => fases.find((f) => f.nome === nome);
const nomesSeg = (fases, nome) => seguintes(fases, fases.findIndex((f) => f.nome === nome)).map((id) => fases.find((f) => f.id === id).nome);
const cond = (fases, de, para) => por(fases, de).condicoes?.[por(fases, para).id];

test('planilha rica: várias linhas por fase, unidade, agente, ações, modelos e condições', () => {
    const { fases, avisos } = propostaDeTabela([
        ['Fase', 'Unidade', 'Responsável', 'Prazo', 'Atividade', 'Documento', 'Segue para', 'Condição'],
        ['Autuação', 'Secretaria', 'Analista', '2', 'Registrar o pedido', 'Termo de autuação', 'Análise', ''],
        ['', '', '', '', 'Conferir documentos', '', '', ''],
        ['Análise', 'Assessoria', 'Assessor', '10', 'Elaborar parecer', 'Parecer técnico', 'Decisão', ''],
        ['Decisão', 'Gabinete', 'Promotor', '5', 'Decidir', 'Decisão; Despacho', 'Cumprimento; Arquivamento', 'se deferido; se indeferido'],
        ['Cumprimento', 'Secretaria', '', '15', 'Expedir ofícios', 'Ofício', 'Fim', ''],
        ['Arquivamento', 'Secretaria', '', '', 'Arquivar', '', 'Fim', ''],
    ]);
    assert.deepEqual(avisos, []);
    assert.deepEqual(fases.map((f) => f.nome), ['Autuação', 'Análise', 'Decisão', 'Cumprimento', 'Arquivamento']);
    const aut = por(fases, 'Autuação');
    assert.deepEqual(aut.acoes, ['Registrar o pedido', 'Conferir documentos']);
    assert.equal(aut.unidade, 'Secretaria'); assert.equal(aut.agente, 'Analista'); assert.equal(aut.prazo_dias, 2);
    assert.deepEqual(por(fases, 'Decisão').modelos, ['Decisão', 'Despacho']);
    assert.deepEqual(nomesSeg(fases, 'Decisão'), ['Cumprimento', 'Arquivamento']);
    assert.equal(cond(fases, 'Decisão', 'Cumprimento'), 'se deferido');
    assert.equal(cond(fases, 'Decisão', 'Arquivamento'), 'se indeferido');
    assert.equal(por(fases, 'Cumprimento').final, true);
});

test('planilha: condição escrita junto da próxima', () => {
    const { fases } = propostaDeTabela([
        ['Etapa', 'Próximas'],
        ['Decisão', 'Cumprimento (se deferido); se indeferido: Arquivo'],
        ['Cumprimento', 'fim'],
        ['Arquivo', ''],
    ]);
    assert.equal(cond(fases, 'Decisão', 'Cumprimento'), 'se deferido');
    assert.equal(cond(fases, 'Decisão', 'Arquivo'), 'se indeferido');
});

const BPMN = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:collaboration><bpmn:participant id="p1" name="Promotoria" processRef="Proc"/></bpmn:collaboration>
  <bpmn:process id="Proc">
    <bpmn:laneSet>
      <bpmn:lane id="L1" name="Secretaria"><bpmn:flowNodeRef>S</bpmn:flowNodeRef><bpmn:flowNodeRef>T1</bpmn:flowNodeRef><bpmn:flowNodeRef>T4</bpmn:flowNodeRef></bpmn:lane>
      <bpmn:lane id="L2" name="Gabinete do Promotor"><bpmn:flowNodeRef>T2</bpmn:flowNodeRef><bpmn:flowNodeRef>G</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S" name="Pedido recebido"/>
    <bpmn:userTask id="T1" name="Autuar (2 dias)">
      <bpmn:dataOutputAssociation id="da1"><bpmn:targetRef>D1</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:userTask>
    <bpmn:dataObjectReference id="D1" name="Termo de autuação"/>
    <bpmn:task id="T2" name="Analisar e decidir"/>
    <bpmn:exclusiveGateway id="G" name="Procedente?"/>
    <bpmn:task id="T3" name="Arquivar"/>
    <bpmn:task id="T4" name="Cumprir decisão"/>
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="f1" sourceRef="S" targetRef="T1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="T1" targetRef="T2"/>
    <bpmn:sequenceFlow id="f3" sourceRef="T2" targetRef="G"/>
    <bpmn:sequenceFlow id="f4" name="Sim" sourceRef="G" targetRef="T4"/>
    <bpmn:sequenceFlow id="f5" sourceRef="G" targetRef="T3"><bpmn:conditionExpression>Não</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f6" sourceRef="T4" targetRef="E"/>
    <bpmn:sequenceFlow id="f7" sourceRef="T3" targetRef="E"/>
    <bpmn:textAnnotation id="A1"><bpmn:text>Conferir a competência</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="as1" sourceRef="T2" targetRef="A1"/>
  </bpmn:process>
</bpmn:definitions>`;

test('BPMN: raias viram unidades, decisão vira condição, documento vira modelo', () => {
    const { fases } = propostaDeBpmn(BPMN);
    assert.deepEqual(fases.map((f) => f.nome), ['Autuar', 'Analisar e decidir', 'Cumprir decisão', 'Arquivar']);
    assert.equal(por(fases, 'Autuar').prazo_dias, 2);
    assert.equal(por(fases, 'Autuar').unidade, 'Secretaria');
    assert.deepEqual(por(fases, 'Autuar').modelos, ['Termo de autuação']);
    assert.equal(por(fases, 'Analisar e decidir').unidade, 'Gabinete do Promotor');
    assert.equal(por(fases, 'Analisar e decidir').orientacao, 'Conferir a competência');
    assert.equal(por(fases, 'Arquivar').unidade, 'Promotoria', 'sem raia, vale a piscina');
    assert.deepEqual(nomesSeg(fases, 'Analisar e decidir'), ['Cumprir decisão', 'Arquivar']);
    assert.equal(cond(fases, 'Analisar e decidir', 'Cumprir decisão'), 'Sim');
    assert.equal(cond(fases, 'Analisar e decidir', 'Arquivar'), 'Não');
    assert.equal(por(fases, 'Cumprir decisão').final, true);
});

const DRAWIO = `<mxfile><diagram id="d" name="P"><mxGraphModel><root>
<mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="L1" value="Secretaria" style="swimlane;" vertex="1" parent="1"/>
<mxCell id="L2" value="Gabinete" style="swimlane;" vertex="1" parent="1"/>
<mxCell id="i" value="" style="ellipse;" vertex="1" parent="L1"/>
<mxCell id="a" value="Autuação&lt;br&gt;" style="rounded=0;" vertex="1" parent="L1"/>
<mxCell id="b" value="Decisão" style="rounded=0;" vertex="1" parent="L2"/>
<mxCell id="q" value="Deferido?" style="rhombus;" vertex="1" parent="L2"/>
<mxCell id="c" value="Cumprimento - 15 dias" style="rounded=0;" vertex="1" parent="L1"/>
<mxCell id="d" value="Arquivamento" style="rounded=0;" vertex="1" parent="L1"/>
<mxCell id="doc" value="Ofício" style="shape=document;" vertex="1" parent="L1"/>
<mxCell id="e1" edge="1" source="i" target="a" parent="1"/>
<mxCell id="e2" edge="1" source="a" target="b" parent="1"/>
<mxCell id="e3" edge="1" source="b" target="q" parent="1"/>
<mxCell id="e4" value="sim" edge="1" source="q" target="c" parent="1"/>
<mxCell id="e5" edge="1" source="q" target="d" parent="1"/>
<mxCell id="e5l" value="não" style="edgeLabel;" vertex="1" connectable="0" parent="e5"/>
<mxCell id="e6" edge="1" source="c" target="doc" parent="1"/>
</root></mxGraphModel></diagram></mxfile>`;

test('draw.io: raias, losango, rótulos de seta (inclusive edgeLabel) e documento', async () => {
    const { fases } = await propostaDeDrawio(DRAWIO);
    assert.deepEqual(fases.map((f) => f.nome), ['Autuação', 'Decisão', 'Cumprimento', 'Arquivamento']);
    assert.equal(por(fases, 'Decisão').unidade, 'Gabinete');
    assert.equal(por(fases, 'Cumprimento').prazo_dias, 15);
    assert.deepEqual(por(fases, 'Cumprimento').modelos, ['Ofício']);
    assert.equal(cond(fases, 'Decisão', 'Cumprimento'), 'sim');
    assert.equal(cond(fases, 'Decisão', 'Arquivamento'), 'não');
});

test('draw.io comprimido', async () => {
    const interno = DRAWIO.match(/<mxGraphModel>[\s\S]*<\/mxGraphModel>/)[0];
    const b64 = deflateRawSync(Buffer.from(encodeURIComponent(interno))).toString('base64');
    const { fases } = await propostaDeDrawio(`<mxfile><diagram id="d">${b64}</diagram></mxfile>`);
    assert.equal(fases.length, 4);
});

test('Mermaid: subgraph como unidade e decisão com rótulos', () => {
    const { fases } = propostaDeMermaid(`flowchart TD
  subgraph Secretaria
    A[Autuação] --> B
  end
  subgraph G [Gabinete]
    B[Decisão] --> C{Deferido?}
  end
  C -->|Sim| D[Cumprimento]
  C -- Não --> E[Arquivamento]`);
    assert.deepEqual(fases.map((f) => f.nome), ['Autuação', 'Decisão', 'Cumprimento', 'Arquivamento']);
    assert.equal(por(fases, 'Autuação').unidade, 'Secretaria');
    assert.equal(por(fases, 'Decisão').unidade, 'Gabinete');
    assert.equal(cond(fases, 'Decisão', 'Cumprimento'), 'Sim');
    assert.equal(cond(fases, 'Decisão', 'Arquivamento'), 'Não');
});

test('texto corrido (Word/PDF): fases, chaves, itens e "se..., segue para"', () => {
    const { fases, nome } = propostaDeTexto(`Rito do procedimento de notícia de fato
Fase 1 – Autuação
Unidade: Secretaria
Responsável: Analista
Prazo de 2 dias.
- Registrar a notícia
- Conferir a competência
Documentos: Termo de autuação; Certidão
Fase 2 – Análise
Unidade: Gabinete
Se houver indícios, segue para Instauração.
Se não houver indícios, segue para Arquivamento.
Fase 3 – Instauração
Prazo: 30 dias
Segue para: fim
Fase 4 – Arquivamento
Comunicar o noticiante e arquivar.`);
    assert.equal(nome, 'Rito do procedimento de notícia de fato');
    assert.deepEqual(fases.map((f) => f.nome), ['Autuação', 'Análise', 'Instauração', 'Arquivamento']);
    const a = por(fases, 'Autuação');
    assert.equal(a.unidade, 'Secretaria'); assert.equal(a.agente, 'Analista'); assert.equal(a.prazo_dias, 2);
    assert.deepEqual(a.acoes, ['Registrar a notícia', 'Conferir a competência']);
    assert.deepEqual(a.modelos, ['Termo de autuação', 'Certidão']);
    assert.deepEqual(nomesSeg(fases, 'Análise'), ['Instauração', 'Arquivamento']);
    assert.equal(cond(fases, 'Análise', 'Instauração'), 'se houver indícios');
    assert.equal(por(fases, 'Instauração').prazo_dias, 30);
    assert.equal(por(fases, 'Instauração').final, true);
    assert.equal(por(fases, 'Arquivamento').orientacao, 'Comunicar o noticiante e arquivar.');
});

test('texto sem fases avisa', () => {
    assert.equal(propostaDeTexto('um parágrafo qualquer sem estrutura').fases.length, 0);
});

test('detecção do formato', async () => {
    assert.equal((await propostaDeConteudo(BPMN)).origem, 'BPMN');
    assert.equal((await propostaDeConteudo(DRAWIO)).origem, 'draw.io');
    assert.equal((await propostaDeConteudo('graph LR\nA-->B')).origem, 'Mermaid');
    assert.equal((await propostaDeConteudo('Fase\tPrazo\nA\t2\nB\t3')).origem, 'tabela');
    assert.equal((await propostaDeConteudo('1. Autuação\n2. Decisão')).origem, 'texto');
});

test('vínculo: casa unidades e modelos existentes e lista o que será criado', () => {
    const { fases } = propostaDeTabela([
        ['Fase', 'Unidade', 'Modelos'], ['Autuação', 'SEC', 'Termo'], ['Parecer', 'Assessoria Jurídica', 'Parecer técnico; Ofício de requisição'],
    ]);
    const v = vincularProposta({ fases }, {
        unidades: [{ id: 'u1', nome: 'Secretaria', sigla: 'SEC', ativa: true }],
        modelos: [{ id: 'm1', nome: 'Termo', unidade_id: null }],
        documento: { tipos_documento: ['Parecer', 'Ofício'] },
    });
    assert.equal(v.fases[0].unidade_ref, 'u1');
    assert.deepEqual(v.fases[0].modelos_ref, ['m1']);
    assert.deepEqual(v.unidades, [{ ref: '+0', nome: 'Assessoria Jurídica', tipo: 'assessoria' }]);
    assert.deepEqual(v.modelos.map((m) => [m.nome, m.unidade_ref, m.tipo_documento]), [['Parecer técnico', '+0', 'Parecer'], ['Ofício de requisição', '+0', 'Ofício']]);
    assert.equal(tipoProvavel('Gabinete da Promotoria'), 'gabinete');
});
