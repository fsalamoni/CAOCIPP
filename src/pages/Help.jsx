import React, { Suspense, lazy, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GLOSSARIO } from '@/lib/glossario';
import {
  HelpCircle,
  Users,
  FileText,
  BarChart3,
  Building2,
  Mail,
  Gavel
} from 'lucide-react';

// O guia do rito só carrega na Central de Ajuda (traz o desenho do rito e as listas do editor).
const GuiaRito = lazy(() => import('@/components/secretaria/GuiaRito'));

export default function Help() {
  // Chegando por link com #secao (ex.: ajuda do Processo Eletrônico), rola até ela.
  useEffect(() => {
    const el = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, []);
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Central de Ajuda</h1>
        <p className="text-slate-600 dark:text-slate-300">Aprenda a usar todas as funcionalidades da plataforma</p>
      </div>

      {/* Getting Started */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Primeiros Passos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <HelpItem
            number="1"
            title="Criar ou Ingressar em uma Organização"
            description="Acesse 'Meu Perfil' e crie uma nova organização ou ingresse em uma existente usando o código de convite."
          />
          <HelpItem
            number="2"
            title="Adicionar Membros"
            description="Compartilhe o código de convite da sua organização com outros usuários. Você encontra o código em 'Informações Gerais'."
          />
          <HelpItem
            number="3"
            title="Cadastrar Processos"
            description="Na aba 'Controle de Processos', clique em 'Adicionar Processo' e preencha os dados do processo jurídico."
          />
          <HelpItem
            number="4"
            title="Acompanhar Status"
            description="O status dos processos é calculado automaticamente baseado nas datas preenchidas. Acompanhe no dashboard."
          />
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <FeatureCard
          icon={Building2}
          title="Organizações"
          items={[
            "Crie múltiplas organizações",
            "Convide membros com código único",
            "Defina funções para cada membro",
            "Controle de acesso por organização"
          ]}
        />
        <FeatureCard
          icon={FileText}
          title="Processos"
          items={[
            "Cadastro completo de processos",
            "Status automático baseado em datas",
            "Atribuição de responsáveis",
            "Marcação de processos urgentes"
          ]}
        />
        <FeatureCard
          icon={BarChart3}
          title="Dashboards"
          items={[
            "Métricas em tempo real",
            "Gráficos de distribuição",
            "Análise de performance",
            "Tempo médio de resposta"
          ]}
        />
        <FeatureCard
          icon={Users}
          title="Colaboração"
          items={[
            "Múltiplos assessores por organização",
            "Sistema de notificações",
            "Logs de auditoria",
            "Controle de permissões"
          ]}
        />
      </div>

      {/* Status Flow */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Fluxo de Status dos Processos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusFlow step="1" status="Pendente" description="Estado padrão para novos processos (Fundo Branco)." />
            <StatusFlow step="2" status="Em elaboração" description="Análise iniciada (Fundo Amarelo/Âmbar)." />
            <StatusFlow step="3" status="Em revisão" description="Remessa para revisão técnica (Fundo Azul)." />
            <StatusFlow step="4" status="Revisadas" description="Revisão concluída pelo responsável (Fundo Roxo)." />
            <StatusFlow step="5" status="Na pasta" description="Processo finalizado e arquivado (Fundo Verde)." />
          </div>
          <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <p className="text-sm text-indigo-900 dark:text-indigo-200">
              💡 <strong>Dica:</strong> O status é calculado automaticamente baseado nas datas que você preenche.
              Você não precisa alterar o status manualmente!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Processo Eletrônico */}
      <Card id="processo-eletronico" className="shadow-sm border-slate-200 dark:border-slate-700 scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5" />
            Processo Eletrônico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Módulo opcional do órgão para tramitar processos próprios: autuação, ritos com fases, documentos assinados e numerados,
            prazos, comunicações, audiências, sessões de colegiado, disputa de preços, portal para as partes e PDF da íntegra. O administrador do órgão liga o módulo no Painel Administrativo, seção Processo Eletrônico.
            Ligado, ele aparece entre as páginas do órgão, na barra do alto e no menu lateral, e as abas internas
            (Meu trabalho, Caixa, Mesa de decisão, Sessões, Todos, Painel, Unidades) ficam no endereço: recarregar ou compartilhar o link mantém a aba.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              icon={Users}
              title="Equipe da unidade"
              items={[
                "Meu trabalho: o que pede sua ação, por urgência; use Assumir para ficar responsável",
                "Nesta fase: marque as ações feitas e abra os modelos com um clique",
                "Botão principal segue o rito: concluir, enviar ou seguir para a próxima fase",
                "Minutas são rascunhos da unidade; Juntar inclui nos autos, com número e data",
                "Ao enviar um arquivo, diga na hora o tipo, do que se trata e se ele é juntado, guardado ou fica como minuta",
                "Ação ligada a um dado do processo se cumpre sozinha quando o dado está preenchido",
                "Arquivos de até 50 MB: o original fica intacto (prova, com hash, em Baixar original) e as folhas usam uma versão leve, sem perda visível",
                "No celular, o PDF abre na própria tela, página a página, com zoom e Baixar",
                "Atalhos: N novo documento, T enviar, J juntar; Ler em sequência lê os autos sem cliques",
              ]}
            />
            <FeatureCard
              icon={Gavel}
              title="Quem decide (gabinete)"
              items={[
                "Mesa de decisão: pendências e petições das partes para apreciar",
                "Apreciar mostra a petição ao lado e permite decidir por despacho",
                "Peça a assinatura de alguém da unidade ou assine e junte num ato",
                "Devolver à secretaria com orientação; a equipe marca Concluída",
              ]}
            />
            <FeatureCard
              icon={HelpCircle}
              title="Avisos e celular"
              items={[
                "Sino da plataforma avisa processo recebido, assinatura pedida, pendência, petição e prazo",
                "Em Avisos, escolha um e-mail por evento, um resumo por dia ou nenhum",
                "No celular, o botão principal fica fixo embaixo e dá para fotografar um documento",
                "Prazos vencendo: alerta diário por e-mail para a unidade",
              ]}
            />
            <FeatureCard
              icon={FileText}
              title="Partes (portal)"
              items={[
                "Entre com Google, senha ou link por e-mail; o convite liga você ao processo",
                "Para você: prazos abertos e intimações; Responder abre a petição guiada",
                "Leia os autos em sequência, exporte a íntegra em PDF ou imprima",
                "Minhas manifestações mostram o comprovante com código de verificação",
                "Advogado ou procurador: a secretaria convida o representante, que entra com a própria conta e fala pela parte",
                "Membro do órgão que é parte em um processo só o alcança pelo portal (menu: Processos em que sou parte); nele, não é o órgão",
              ]}
            />
            <FeatureCard
              icon={Gavel}
              title="Sessões e colegiados"
              items={[
                "Na aba Sessões, a secretaria do colegiado monta a sessão, a pauta e publica; reuniões deliberam sem processo",
                "Quem julga lê os autos enquanto o processo está pautado (cada leitura fica registrada) e anota só para si",
                "Relator e vogais votam; há vista, adiamento, divergência, voto condutor e acórdão; a sessão pode ser virtual",
                "O resultado proclamado cumpre a ação de julgamento do rito; ata, painel ao vivo e relatório do colegiado",
              ]}
            />
            <FeatureCard
              icon={FileText}
              title="Disputa de preços"
              items={[
                "Ação do rito que pede uma disputa: cotação privada entre convidados ou dispensa",
                "O fornecedor convidado envia proposta e lances em Disputas; as propostas ficam sigilosas até a abertura",
                "Agente, apoio e autoridade têm papéis próprios; o fornecedor não é parte e não vê os autos",
                "O resultado (homologada, deserta ou fracassada) cumpre a ação e segue o rito",
              ]}
            />
            <FeatureCard
              icon={Building2}
              title="Ritos e modelos do órgão"
              items={[
                "Em Ritos, Novo rito: comece de um modelo da biblioteca, de um arquivo ou em branco",
                "Os modelos da biblioteca são da plataforma; usar um cria uma cópia só do seu órgão, que a biblioteca não altera",
                "Toda ferramenta dos modelos (sessão, disputa, audiência, comunicação, formulário) está no editor para qualquer rito",
                "Exportar para outro órgão e Importar de outro órgão levam o rito inteiro ou um modelo de documento, sem dados do seu órgão",
              ]}
            />
          </div>
          <section id="guia-do-rito" aria-labelledby="guia-rito-titulo" className="scroll-mt-24 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <h3 id="guia-rito-titulo" className="font-semibold text-slate-900 dark:text-white">Guia do rito</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Abre no <strong>Tutorial</strong>: um passo a passo em 12 etapas para montar o rito do começo ao fim, com perguntas e
              respostas em cada etapa; "Quero fazer…", que diz qual ferramenta usar para cada situação, onde ela fica e o modelo que já
              faz assim; e "Qual modelo usar?", que indica os modelos da biblioteca pelo assunto, pela forma de decidir e pelo tamanho.
              A <strong>Referência</strong> explica, em 20 partes, cada peça e cada opção do editor, com um exemplo completo. Serve para
              quem monta o rito e para quem trabalha no processo entender por que cada passo acontece.
            </p>
            <Suspense fallback={<p className="text-sm text-slate-600 dark:text-slate-400">Carregando o guia…</p>}>
              <GuiaRito inicial={window.location.hash === '#guia-do-rito'} />
            </Suspense>
          </section>
          <section id="glossario" aria-labelledby="glossario-titulo" className="scroll-mt-24 space-y-3">
            <h3 id="glossario-titulo" className="font-semibold text-slate-900 dark:text-white">Glossário</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {Object.values(GLOSSARIO).map((t) => (
                <div key={t.termo}>
                  <dt className="text-sm font-medium text-indigo-900 dark:text-indigo-200">{t.termo}</dt>
                  <dd className="text-sm text-slate-600 dark:text-slate-300">{t.definicao}</dd>
                </div>
              ))}
            </dl>
          </section>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-700 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Precisa de mais ajuda?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Entre em contato com o suporte para assistência personalizada
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HelpItem({ number, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, items }) {
  return (
    <Card className="shadow-sm border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="text-indigo-600 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatusFlow({ step, status, description }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold shrink-0">
        {step}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-slate-900 dark:text-white">{status}</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">{description}</div>
      </div>
    </div>
  );
}