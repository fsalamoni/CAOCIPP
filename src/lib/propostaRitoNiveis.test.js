// npm run test:lib — importação de rito com várias páginas, abas, subprocessos e paralelos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propostaDeAbas, propostaDeBpmn, propostaDeConteudo, propostaDeDiagramas, propostaDeTexto, propostaDeXpdl } from './propostaRito.js';
import { seguintes } from './secretariaRito.js';

const nomes = (fases) => fases.map((f) => f.nome);
const por = (fases, nome) => fases.find((f) => f.nome === nome);
const seg = (fases, nome) => seguintes(fases, fases.findIndex((f) => f.nome === nome)).map((id) => fases.find((f) => f.id === id).nome);

// Página principal do Bizagi (XPDL 2.2): raias, decisão, subprocesso embutido
// (BlockActivity) e chamada de subprocesso de outra página (SubFlow).
const XPDL_PRINCIPAL = `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://www.wfmc.org/2009/XPDL2.2" Id="pk1" Name="Notícia de fato">
  <Pools><Pool Id="pool1" Name="Promotoria" Process="p1"><Lanes>
    <Lane Id="L1" Name="Secretaria" ParentPool="pool1"/><Lane Id="L2" Name="Gabinete" ParentPool="pool1"/>
  </Lanes></Pool></Pools>
  <Artifacts><Artifact Id="d1" ArtifactType="DataObject" Name="Despacho inicial"/><Artifact Id="n1" ArtifactType="Annotation" TextAnnotation="Conferir competência"/></Artifacts>
  <Associations><Association Id="as1" Source="a2" Target="d1"/><Association Id="as2" Source="n1" Target="a2"/></Associations>
  <WorkflowProcesses><WorkflowProcess Id="p1" Name="Notícia de fato">
    <ActivitySets><ActivitySet Id="set1" Name="Instrução">
      <Activities>
        <Activity Id="s0" Name="Início"><Event><StartEvent Trigger="None"/></Event></Activity>
        <Activity Id="s1" Name="Requisitar informações"><Implementation><Task/></Implementation></Activity>
        <Activity Id="s2" Name="Analisar respostas"><Implementation><Task/></Implementation></Activity>
        <Activity Id="s9" Name="Fim"><Event><EndEvent/></Event></Activity>
      </Activities>
      <Transitions><Transition Id="ts1" From="s0" To="s1"/><Transition Id="ts2" From="s1" To="s2"/><Transition Id="ts3" From="s2" To="s9"/></Transitions>
    </ActivitySet></ActivitySets>
    <Activities>
      <Activity Id="a0" Name="Início"><Event><StartEvent Trigger="None"/></Event><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L1"/></NodeGraphicsInfos></Activity>
      <Activity Id="a1" Name="Autuar"><Description>Registrar no sistema</Description><Implementation><Task><TaskUser/></Task></Implementation><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L1"/></NodeGraphicsInfos></Activity>
      <Activity Id="a2" Name="Despachar"><Implementation><Task/></Implementation><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L2"/></NodeGraphicsInfos></Activity>
      <Activity Id="g1" Name="Instaurar?"><Route GatewayType="Exclusive"/><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L2"/></NodeGraphicsInfos></Activity>
      <Activity Id="a3" Name="Instrução"><BlockActivity ActivitySetId="set1"/><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L1"/></NodeGraphicsInfos></Activity>
      <Activity Id="a4" Name="Diligências externas"><Implementation><SubFlow Id="p2"/></Implementation><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L1"/></NodeGraphicsInfos></Activity>
      <Activity Id="a5" Name="Arquivar"><Implementation><Task/></Implementation><NodeGraphicsInfos><NodeGraphicsInfo LaneId="L1"/></NodeGraphicsInfos></Activity>
      <Activity Id="a9" Name="Fim"><Event><EndEvent/></Event></Activity>
    </Activities>
    <Transitions>
      <Transition Id="t1" From="a0" To="a1"/><Transition Id="t2" From="a1" To="a2"/><Transition Id="t3" From="a2" To="g1"/>
      <Transition Id="t4" From="g1" To="a3" Name="Sim"/><Transition Id="t5" From="g1" To="a5" Name="Não"/>
      <Transition Id="t6" From="a3" To="a4"/><Transition Id="t7" From="a4" To="a9"/><Transition Id="t8" From="a5" To="a9"/>
    </Transitions>
  </WorkflowProcess></WorkflowProcesses>
</Package>`;

// Outra página do pacote: o subprocesso "Diligências externas", com dois ramos paralelos.
const XPDL_SUB = `<Package xmlns="http://www.wfmc.org/2009/XPDL2.2" Id="pk2" Name="Diligências">
  <Pools><Pool Id="pool2" Name="Diligências" Process="p2"><Lanes><Lane Id="M1" Name="Oficialato"/></Lanes></Pool></Pools>
  <WorkflowProcesses><WorkflowProcess Id="p2" Name="Diligências externas">
    <Activities>
      <Activity Id="b0"><Event><StartEvent/></Event></Activity>
      <Activity Id="bp" Name=""><Route GatewayType="Parallel"/></Activity>
      <Activity Id="b1" Name="Ouvir testemunha"><NodeGraphicsInfos><NodeGraphicsInfo LaneId="M1"/></NodeGraphicsInfos></Activity>
      <Activity Id="b2" Name="Vistoriar local"><NodeGraphicsInfos><NodeGraphicsInfo LaneId="M1"/></NodeGraphicsInfos></Activity>
      <Activity Id="bj" Name=""><Route GatewayType="Parallel"/></Activity>
      <Activity Id="b3" Name="Juntar relatório"/>
      <Activity Id="b9"><Event><EndEvent/></Event></Activity>
    </Activities>
    <Transitions>
      <Transition From="b0" To="bp"/><Transition From="bp" To="b1"/><Transition From="bp" To="b2"/>
      <Transition From="b1" To="bj"/><Transition From="b2" To="bj"/><Transition From="bj" To="b3"/><Transition From="b3" To="b9"/>
    </Transitions>
  </WorkflowProcess></WorkflowProcesses>
</Package>`;

test('Bizagi com duas páginas: subprocessos se abrem no lugar e paralelos ficam em sequência', () => {
    const { fases, avisos } = propostaDeDiagramas([{ nome: 'a/Diagram.xml', xml: XPDL_PRINCIPAL }, { nome: 'b/Diagram.xml', xml: XPDL_SUB }]);
    assert.deepEqual(nomes(fases), ['Autuar', 'Despachar', 'Requisitar informações', 'Arquivar', 'Analisar respostas', 'Ouvir testemunha', 'Vistoriar local', 'Juntar relatório']);
    assert.equal(por(fases, 'Autuar').unidade, 'Secretaria');
    assert.equal(por(fases, 'Autuar').orientacao, 'Registrar no sistema');
    assert.equal(por(fases, 'Despachar').unidade, 'Gabinete');
    assert.deepEqual(por(fases, 'Despachar').modelos, ['Despacho inicial']);
    assert.match(por(fases, 'Despachar').orientacao, /Conferir competência/);
    // Decisão: Sim entra no subprocesso embutido; Não arquiva.
    assert.deepEqual(seg(fases, 'Despachar'), ['Requisitar informações', 'Arquivar']);
    assert.equal(por(fases, 'Despachar').condicoes[por(fases, 'Requisitar informações').id], 'Sim');
    assert.ok(por(fases, 'Arquivar').final);
    // Etapas do subprocesso herdam a raia da atividade e dizem de onde vêm.
    assert.equal(por(fases, 'Requisitar informações').unidade, 'Secretaria');
    assert.match(por(fases, 'Requisitar informações').orientacao, /subprocesso "Instrução"/);
    // Fim do subprocesso embutido segue para a atividade seguinte (a da outra página).
    assert.deepEqual(seg(fases, 'Analisar respostas'), ['Ouvir testemunha']);
    // Paralelos: um depois do outro, com anotação, e depois a junção.
    assert.deepEqual(seg(fases, 'Ouvir testemunha'), ['Vistoriar local']);
    assert.deepEqual(seg(fases, 'Vistoriar local'), ['Juntar relatório']);
    assert.match(por(fases, 'Ouvir testemunha').orientacao, /paralelo com: Vistoriar local/);
    assert.equal(por(fases, 'Ouvir testemunha').unidade, 'Oficialato');
    assert.equal(seg(fases, 'Juntar relatório').length, 0);
    assert.ok(avisos.some((a) => /2 páginas/.test(a)));
    assert.ok(avisos.some((a) => /paralelas/.test(a)));
});

test('XPDL sozinho é detectado pelo conteúdo', async () => {
    const r = await propostaDeConteudo(XPDL_SUB, 'diligencias.xml');
    assert.equal(r.origem, 'XPDL');
    assert.deepEqual(nomes(r.fases), ['Ouvir testemunha', 'Vistoriar local', 'Juntar relatório']);
    assert.equal(propostaDeXpdl('<Package/>').fases.length, 0);
});

const BPMN_NIVEIS = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
  <bpmn:collaboration id="c">
    <bpmn:participant id="P1" name="Unidade" processRef="proc1"/>
    <bpmn:participant id="P2" name="Corregedoria" processRef="proc2"/>
    <bpmn:messageFlow id="m1" sourceRef="t2" targetRef="s2"/>
  </bpmn:collaboration>
  <bpmn:process id="proc1">
    <bpmn:startEvent id="s1"/>
    <bpmn:task id="t1" name="Receber pedido"><bpmn:documentation>Conferir os anexos</bpmn:documentation></bpmn:task>
    <bpmn:subProcess id="sp" name="Análise">
      <bpmn:startEvent id="sps"/>
      <bpmn:parallelGateway id="pg"/>
      <bpmn:task id="a1" name="Parecer técnico"/>
      <bpmn:task id="a2" name="Parecer jurídico"/>
      <bpmn:parallelGateway id="pj"/>
      <bpmn:endEvent id="spe"/>
      <bpmn:sequenceFlow id="x1" sourceRef="sps" targetRef="pg"/>
      <bpmn:sequenceFlow id="x2" sourceRef="pg" targetRef="a1"/>
      <bpmn:sequenceFlow id="x3" sourceRef="pg" targetRef="a2"/>
      <bpmn:sequenceFlow id="x4" sourceRef="a1" targetRef="pj"/>
      <bpmn:sequenceFlow id="x5" sourceRef="a2" targetRef="pj"/>
      <bpmn:sequenceFlow id="x6" sourceRef="pj" targetRef="spe"/>
    </bpmn:subProcess>
    <bpmn:task id="t2" name="Comunicar corregedoria"/>
    <bpmn:endEvent id="e1"/>
    <bpmn:sequenceFlow id="f1" sourceRef="s1" targetRef="t1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="t1" targetRef="sp"/>
    <bpmn:sequenceFlow id="f3" sourceRef="sp" targetRef="t2"/>
    <bpmn:sequenceFlow id="f4" sourceRef="t2" targetRef="e1"/>
  </bpmn:process>
  <bpmn:process id="proc2">
    <bpmn:startEvent id="s2"/>
    <bpmn:task id="c1" name="Registrar ciência"/>
    <bpmn:endEvent id="e2"/>
    <bpmn:sequenceFlow id="g1" sourceRef="s2" targetRef="c1"/>
    <bpmn:sequenceFlow id="g2" sourceRef="c1" targetRef="e2"/>
  </bpmn:process>
</bpmn:definitions>`;

test('BPMN: subprocesso embutido com paralelo dentro e mensagem para outra piscina', () => {
    const { fases } = propostaDeBpmn(BPMN_NIVEIS);
    assert.deepEqual(nomes(fases), ['Receber pedido', 'Parecer técnico', 'Parecer jurídico', 'Comunicar corregedoria', 'Registrar ciência']);
    assert.equal(por(fases, 'Receber pedido').orientacao, 'Conferir os anexos');
    assert.deepEqual(seg(fases, 'Parecer técnico'), ['Parecer jurídico']);
    assert.deepEqual(seg(fases, 'Parecer jurídico'), ['Comunicar corregedoria']);
    assert.equal(por(fases, 'Parecer jurídico').unidade, 'Unidade');
    assert.match(por(fases, 'Parecer jurídico').orientacao, /subprocesso "Análise".*paralelo com: Parecer técnico/);
    // A mensagem leva o processo para a piscina da Corregedoria.
    assert.deepEqual(seg(fases, 'Comunicar corregedoria'), ['Registrar ciência']);
    assert.equal(por(fases, 'Registrar ciência').unidade, 'Corregedoria');
});

test('BPMN: callActivity abre o processo chamado; processos soltos ficam em sequência', () => {
    const xml = `<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
      <process id="A" name="Principal"><startEvent id="i"/><task id="t1" name="Autuar"/><callActivity id="ca" name="Perícia" calledElement="B"/><endEvent id="f"/>
        <sequenceFlow sourceRef="i" targetRef="t1"/><sequenceFlow sourceRef="t1" targetRef="ca"/><sequenceFlow sourceRef="ca" targetRef="f"/></process>
      <process id="B" name="Perícia"><startEvent id="bi"/><task id="b1" name="Nomear perito"/><task id="b2" name="Receber laudo"/><endEvent id="bf"/>
        <sequenceFlow sourceRef="bi" targetRef="b1"/><sequenceFlow sourceRef="b1" targetRef="b2"/><sequenceFlow sourceRef="b2" targetRef="bf"/></process>
      <process id="C" name="Encerramento"><startEvent id="ci"/><task id="c1" name="Arquivar"/><endEvent id="cf"/>
        <sequenceFlow sourceRef="ci" targetRef="c1"/><sequenceFlow sourceRef="c1" targetRef="cf"/></process>
    </definitions>`;
    const { fases, avisos } = propostaDeBpmn(xml);
    assert.deepEqual(nomes(fases), ['Autuar', 'Nomear perito', 'Receber laudo', 'Arquivar']);
    assert.deepEqual(seg(fases, 'Receber laudo'), ['Arquivar']);
    assert.ok(avisos.some((a) => /em sequência \(Principal → Encerramento\)/.test(a)));
});

test('planilha com várias abas: aba de detalhamento, macroetapa, saída para outra aba e paralela', () => {
    const { fases, avisos } = propostaDeAbas([
        { nome: 'Rito', linhas: [
            ['Rito da notícia de fato'],
            ['Fase', 'Unidade', 'Prazo', 'Segue para', 'Condição'],
            ['Autuação', 'Secretaria', '2'],
            ['Instrução', 'Assessoria', ''],
            ['Decisão', 'Gabinete', '10', 'Arquivamento; Recurso', 'se arquivar; se houver recurso'],
            ['Arquivamento', 'Secretaria', '', 'fim'],
        ] },
        { nome: 'Instrução', linhas: [
            ['Fase', 'Fase principal', 'Paralela'],
            ['Requisições', ''],
            ['Ofício à prefeitura', 'Requisições', 'Ofício à câmara'],
            ['Ofício à câmara', 'Requisições', 'Ofício à prefeitura'],
            ['Relatório', ''],
        ] },
        { nome: 'Recurso', linhas: [
            ['Etapa', 'Unidade', 'Segue para'],
            ['Contrarrazões', 'Secretaria'],
            ['Remessa ao Conselho', 'Secretaria', 'fim'],
        ] },
        { nome: 'Legenda', linhas: [['Cores'], ['verde = concluído']] },
    ]);
    assert.deepEqual(nomes(fases), ['Autuação', 'Ofício à prefeitura', 'Ofício à câmara', 'Relatório', 'Decisão', 'Arquivamento', 'Contrarrazões', 'Remessa ao Conselho']);
    // A aba "Instrução" entra no lugar da fase; as etapas herdam a unidade.
    assert.deepEqual(seg(fases, 'Autuação'), ['Ofício à prefeitura']);
    assert.equal(por(fases, 'Relatório').unidade, 'Assessoria');
    assert.match(por(fases, 'Ofício à câmara').orientacao, /Parte de "Instrução › Requisições"/);
    assert.match(por(fases, 'Ofício à câmara').orientacao, /paralelo com: Ofício à prefeitura/);
    assert.deepEqual(seg(fases, 'Relatório'), ['Decisão']);
    // "Recurso" é o nome de uma aba: vai para a primeira etapa dela.
    assert.deepEqual(seg(fases, 'Decisão'), ['Arquivamento', 'Contrarrazões']);
    assert.equal(por(fases, 'Decisão').condicoes[por(fases, 'Contrarrazões').id], 'se houver recurso');
    assert.ok(por(fases, 'Arquivamento').final);
    assert.equal(seg(fases, 'Remessa ao Conselho').length, 0);
    assert.ok(avisos.some((a) => /Lidas 3 abas/.test(a)));
});

test('texto de PDF com número colado ao nome ("1.Autuação")', () => {
    const { fases } = propostaDeTexto('Procedimento\n1.Autuação\nUnidade: Secretaria\n1.1 Registrar\n2.Decisão\nUnidade: Gabinete');
    assert.deepEqual(nomes(fases), ['Autuação', 'Decisão']);
    assert.deepEqual(por(fases, 'Autuação').acoes, ['Registrar']);
});
