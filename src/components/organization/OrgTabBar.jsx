import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { orgTabUrl } from '@/lib/organizationModules';

/**
 * OrgTabBar — navegação entre as páginas do órgão, dentro do próprio
 * conteúdo (Novo design V2). Existe para que a navegação continue possível
 * quando a sidebar está colapsada (só ícones) — nesse modo, o sub-menu do
 * órgão na sidebar fica oculto. Aparece também no Processo Eletrônico, que
 * tem página própria mas é uma das páginas do órgão.
 *
 * A partir de `sm`: grade (`auto-fit, minmax`) — os itens dividem o espaço e
 * quebram de linha sozinhos, sem esconder nada atrás de rolagem.
 * No celular: uma faixa única que rola na horizontal, com a página atual
 * trazida para a vista. Em grade, 10+ páginas ocupavam a primeira tela
 * inteira e empurravam o conteúdo para baixo.
 */
export default function OrgTabBar({ tabs, activeTab, orgId }) {
  const navRef = useRef(null);

  // Celular: rola a faixa até a página atual (sem mexer na rolagem vertical).
  useEffect(() => {
    const nav = navRef.current;
    const ativo = nav?.querySelector('[aria-current="page"]');
    if (!nav || !ativo || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = ativo.offsetLeft - (nav.clientWidth - ativo.offsetWidth) / 2;
  }, [activeTab, tabs]);

  if (!tabs || tabs.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Páginas do órgão"
      className={cn(
        'flex overflow-x-auto overflow-y-hidden gap-1 border-b border-border mb-6 [scrollbar-width:thin]',
        'sm:grid sm:overflow-visible sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]'
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            to={orgTabUrl(tab, orgId)}
            aria-current={active ? 'page' : undefined}
            title={tab.label}
            className={cn(
              'flex shrink-0 items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-center whitespace-nowrap',
              'border-b-2 -mb-px transition-colors sm:shrink sm:min-w-0',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />}
            <span className="sm:truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
