import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { Link2, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ROTULO_MODULO } from '@/lib/camposProcesso';
import { buscarRegistros } from '@/lib/registrosModulos';
import { useEntityTypes } from '@/hooks/useCustomEntities';

/**
 * Órgão, integrações que valem e páginas próprias do órgão ([{ id, nome,
 * plural }]), para os seletores de registro (Processo Eletrônico e Configuração).
 */
export const RegistroContexto = createContext({ orgId: null, ligadas: {}, paginas: [] });

/** Provê o RegistroContexto; as páginas próprias só são lidas com a integração ligada. */
export function ProvedorRegistros({ orgId, ligadas, children }) {
    const { entityTypes } = useEntityTypes(ligadas?.paginas ? orgId : null);
    const paginas = (entityTypes || []).filter((t) => t.enabled !== false)
        .map((t) => ({ id: t.id, nome: t.label_singular || 'Página', plural: t.label_plural || t.label_singular || 'Página' }));
    return <RegistroContexto.Provider value={{ orgId, ligadas, paginas }}>{children}</RegistroContexto.Provider>;
}

/** Nome do módulo (ou da página própria) para os textos do seletor. */
export function nomeDoModulo(modulo, pagina, paginas) {
    if (modulo === 'paginas') return (paginas || []).find((x) => x.id === pagina)?.plural || 'páginas próprias';
    return ROTULO_MODULO[modulo] || 'outro módulo';
}

/**
 * Escolhe um registro de outro módulo do órgão (Consultas, Expedientes,
 * Parcerias, Júri ou a página própria `pagina`) pelo número ou título.
 * `value`: { id, numero, titulo } ou ''.
 * Combobox acessível: setas, Enter e Esc (Esc fecha só a lista, não o diálogo).
 */
export default function SeletorRegistro({ id, modulo, pagina, value, onChange, disabled, autoFocus, ...aria }) {
    const { orgId, ligadas, paginas } = useContext(RegistroContexto);
    const listaId = useId();
    const [texto, setTexto] = useState('');
    const [aberto, setAberto] = useState(false);
    const [itens, setItens] = useState([]);
    // Texto da última busca concluída: Enter só escolhe da lista que corresponde ao que está digitado.
    const [buscado, setBuscado] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const [ativo, setAtivo] = useState(0);
    const [anuncio, setAnuncio] = useState('');
    const inputRef = useRef(null);
    const trocarRef = useRef(null);
    const nomeModulo = nomeDoModulo(modulo, pagina, paginas);
    const ligada = ligadas?.[modulo] === true;
    const pronta = !carregando && !erro && buscado === texto;

    useEffect(() => {
        if (!aberto || !ligada) return undefined;
        let vivo = true;
        setCarregando(true);
        const t = setTimeout(() => {
            buscarRegistros(orgId, modulo, texto, pagina)
                .then((l) => { if (vivo) { setItens(l); setBuscado(texto); setErro(''); setAtivo(0); } })
                .catch(() => { if (vivo) setErro(`Não foi possível buscar em ${nomeModulo}`); })
                .finally(() => vivo && setCarregando(false));
        }, 250);
        return () => { vivo = false; clearTimeout(t); };
    }, [aberto, texto, orgId, modulo, pagina, ligada, nomeModulo]);

    // Esc com a lista aberta fecha só a lista: o diálogo em volta (Radix) escuta no document, então paramos antes, na janela.
    useEffect(() => {
        if (!aberto) return undefined;
        const h = (e) => {
            if (e.key !== 'Escape' || document.activeElement !== inputRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            setAberto(false);
        };
        window.addEventListener('keydown', h, true);
        return () => window.removeEventListener('keydown', h, true);
    }, [aberto]);

    const escolher = (r) => {
        // Dados (ou a marca de restrito) seguem para pré-preencher campos; o servidor só usa o id.
        onChange({ id: r.id, numero: r.numero, titulo: r.titulo, ...(r.restrito ? { restrito: true } : r.dados ? { dados: r.dados } : {}) });
        setAberto(false);
        setTexto('');
        setAnuncio(`Escolhido ${r.numero}${r.titulo ? `, ${r.titulo}` : ''}`);
        setTimeout(() => trocarRef.current?.focus(), 0);
    };
    const status = <span role="status" className="sr-only">{anuncio}</span>;

    if (value?.id) {
        return (
            <>
                <div className="mt-1 flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                    <Link2 className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                    <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium text-slate-800 dark:text-slate-100 break-words">{value.numero}</p>
                        <p className="text-slate-600 dark:text-slate-400 break-words">{value.titulo || nomeModulo}</p>
                        {!ligada && <p className="text-xs text-amber-800 dark:text-amber-200">A integração com {nomeModulo} está desligada: o registro fica como está.</p>}
                    </div>
                    {/* Com a integração desligada, trocar apagaria o registro sem poder escolher outro. */}
                    {!disabled && ligada && (
                        <Button ref={trocarRef} type="button" size="sm" variant="ghost" className="shrink-0 gap-1" aria-label={`Trocar o registro ${value.numero}`}
                            onClick={() => { onChange(''); setAberto(true); setAnuncio(''); setTimeout(() => inputRef.current?.focus(), 0); }}>
                            <X className="w-4 h-4" aria-hidden /> Trocar
                        </Button>
                    )}
                </div>
                {status}
            </>
        );
    }

    if (!ligada) {
        return <p id={id} className="mt-1 text-sm text-amber-800 dark:text-amber-200">A integração com {nomeModulo} está desligada neste órgão. O admin liga na configuração do Processo Eletrônico, em "Integrações com outros módulos".</p>;
    }

    const teclas = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); if (pronta) setAtivo((i) => Math.min(i + 1, Math.max(itens.length - 1, 0))); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (pronta) setAtivo((i) => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && aberto) {
            // Enter nunca escolhe de uma lista velha (busca ainda rodando ou com erro).
            e.preventDefault();
            if (pronta && itens[ativo]) escolher(itens[ativo]);
        }
    };
    const mostrar = aberto && pronta;

    return (
        <div className="relative mt-1">
            <Input id={id} ref={inputRef} role="combobox" aria-expanded={aberto} aria-controls={listaId} aria-autocomplete="list"
                aria-activedescendant={mostrar && itens[ativo] ? `${listaId}-${ativo}` : undefined} {...aria}
                autoFocus={autoFocus} disabled={disabled} value={texto} autoComplete="off"
                placeholder={`Procure pelo número ou assunto em ${nomeModulo}`}
                onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
                onChange={(e) => { setTexto(e.target.value); setAberto(true); }} onKeyDown={teclas} />
            {aberto && (
                <ul id={listaId} role="listbox" aria-label={`Registros de ${nomeModulo}`}
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                    {!mostrar && !erro && <li className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Buscando…</li>}
                    {erro && !carregando && <li className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</li>}
                    {mostrar && !itens.length && (
                        <li className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                            Nada encontrado em {nomeModulo}. A busca por parte do texto olha os 500 registros mais recentes; para um antigo, digite o número completo.
                        </li>
                    )}
                    {mostrar && itens.map((r, i) => (
                        <li key={r.id} id={`${listaId}-${i}`} role="option" aria-selected={i === ativo}
                            className={`cursor-pointer px-3 py-2 text-sm ${i === ativo ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); escolher(r); }} onMouseEnter={() => setAtivo(i)}>
                            <span className="font-medium text-slate-800 dark:text-slate-100">{r.numero}</span>
                            {r.titulo && <span className="block text-slate-600 dark:text-slate-400 truncate">{r.titulo}</span>}
                        </li>
                    ))}
                </ul>
            )}
            {status}
        </div>
    );
}
