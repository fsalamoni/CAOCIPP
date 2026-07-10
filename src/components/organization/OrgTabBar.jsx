import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * OrgTabBar — navegação entre as abas internas do órgão, dentro do próprio
 * conteúdo da página (Novo design V2). Existe para que a navegação entre
 * abas continue possível quando a sidebar está colapsada (só ícones) —
 * nesse modo, o sub-menu do órgão na sidebar fica oculto.
 *
 * Layout em grade (`auto-fit, minmax`) em vez de uma lista simplesmente
 * empilhada/rolável: os itens se distribuem de forma equilibrada dividindo
 * o espaço disponível, e quebram para uma nova linha sozinhos quando não
 * cabem mais na largura atual — se adapta ao número de abas (3 a 8+,
 * incluindo páginas personalizadas) e ao tamanho da tela sem esconder
 * nenhuma opção atrás de rolagem horizontal.
 */
export default function OrgTabBar({ tabs, activeTab, orgId }) {
  if (!tabs || tabs.length === 0) return null;

  return (
    <nav
      className="grid gap-x-1 gap-y-1 border-b border-border mb-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            to={`/Organization?id=${orgId}&tab=${tab.key}`}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-center',
              'border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
