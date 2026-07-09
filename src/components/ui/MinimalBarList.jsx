import React from 'react';
import { cn } from '@/lib/utils';

/**
 * MinimalBarList — lista horizontal com barra fina (label + barra + valor).
 * Padrão de visualização do design V2 (minimalista): mesma leitura de dados
 * de um gráfico de barras, mas escaneável de um relance, sem eixos/tooltip.
 *
 * Props:
 *  - data: array de objetos, cada um com `name` e o campo indicado por `valueKey`.
 *  - valueKey: chave numérica em cada item de `data` a ser exibida na barra.
 *  - colorKey: chave opcional em cada item com a classe Tailwind de bg da barra
 *    (ex.: "bg-primary"). Sem correspondência, usa `bg-primary` para todas as barras.
 */
export default function MinimalBarList({ data, valueKey, colorKey, className }) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className={cn('space-y-3', className)}>
      {data.map((row) => (
        <div key={row.name} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-sm text-muted-foreground truncate" title={row.name}>{row.name}</div>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', (colorKey && row[colorKey]) || 'bg-primary')}
              style={{ width: `${Math.round((Number(row[valueKey]) || 0) / max * 100)}%` }}
            />
          </div>
          <div className="w-8 shrink-0 text-right text-sm font-mono">{row[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}
