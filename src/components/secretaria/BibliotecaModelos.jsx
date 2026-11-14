import React, { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AREAS, PORTES, bibliotecaDeModelos, nomeArea, nomePorte } from '@/lib/bibliotecaRitos';
import { NativeSelect } from './comum';

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Modelos de processo completos, por área e porte: o órgão escolhe um e revisa tudo antes de implantar. */
export default function BibliotecaModelos({ onEscolher }) {
    // Gerados uma vez só para listar; ao escolher, gera de novo com ids novos.
    const modelos = useMemo(() => bibliotecaDeModelos(), []);
    const [area, setArea] = useState('');
    const [porte, setPorte] = useState('');
    const [busca, setBusca] = useState('');
    const areas = AREAS.filter(([a]) => modelos.some((m) => m.area === a));
    const lista = modelos.filter((m) => (!area || m.area === area) && (!porte || m.porte === porte)
        && (!busca.trim() || semAcento(`${m.nome} ${m.descricao} ${m.quando} ${m.base}`).includes(semAcento(busca.trim()))));
    // O id do modelo é da biblioteca, não do rito: com ele, a implantação tomaria o modelo por um rito já gravado.
    const escolher = (id) => {
        const { id: _modelo, ...r } = bibliotecaDeModelos().find((m) => m.id === id);
        onEscolher(r);
    };
    return (
        <section aria-labelledby="biblioteca-titulo" className="space-y-2">
            <h3 id="biblioteca-titulo" className="text-sm font-semibold flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-indigo-600" aria-hidden /> Biblioteca de modelos de processo</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
                {modelos.length} processos completos, com base na lei de cada área: fases, unidades, prazos, comunicações às partes, audiências, documentos e saídas.
                O modelo é só o ponto de partida: tudo pode ser ajustado antes de implantar. Nenhum modelo é penal.
            </p>
            <div className="grid sm:grid-cols-[1fr_1fr_2fr] gap-2 items-end">
                <NativeSelect id="biblioteca-area" label="Área" value={area} onChange={setArea} options={[['', 'Todas as áreas'], ...areas]} />
                <NativeSelect id="biblioteca-porte" label="Porte" value={porte} onChange={setPorte} options={[['', 'Todos os portes'], ...PORTES]} />
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" aria-hidden />
                    <Input aria-label="Buscar modelo" placeholder="Buscar (ex.: licitação, disciplinar, Lei 9.784)" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-9 pl-8" />
                </div>
            </div>
            {!lista.length && <p className="text-xs text-slate-600 dark:text-slate-300">Nenhum modelo com esses filtros.</p>}
            <ul className="grid lg:grid-cols-2 gap-2">
                {lista.map((m) => (
                    <li key={m.id} className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
                        <div className="flex flex-wrap items-start gap-2">
                            <p className="font-medium text-sm flex-1 min-w-[10rem]">{m.nome}</p>
                            <Badge variant="outline" className="text-[11px]">{nomePorte(m.porte)} · {m.fases.length} fases</Badge>
                        </div>
                        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">{nomeArea(m.area)}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{m.descricao}</p>
                        <details className="text-xs">
                            <summary className="cursor-pointer text-indigo-700 dark:text-indigo-300">Quando usar, base legal e fases</summary>
                            <div className="mt-1.5 space-y-1.5 text-slate-600 dark:text-slate-300">
                                <p><b>Quando usar:</b> {m.quando}</p>
                                <p><b>Base:</b> {m.base}</p>
                                {m.tipo?.polos?.length > 0 && <p><b>Partes:</b> {m.tipo.polos.map((x) => m.tipo.nomes_polos?.[x] || x).join(', ')}</p>}
                                <ol className="list-decimal pl-5">{m.fases.map((f) => <li key={f.id}>{f.nome}{f.prazo_dias ? ` (${f.prazo_dias} dias)` : ''}{f.unidade ? `, ${f.unidade}` : ''}</li>)}</ol>
                            </div>
                        </details>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => escolher(m.id)} aria-label={`Usar o modelo ${m.nome}`}>Usar este modelo</Button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
