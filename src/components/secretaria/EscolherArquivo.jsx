import React, { useRef, useState } from 'react';
import { FileCheck2, Upload, X } from 'lucide-react';

// Campo de arquivo em português, no lugar do "Choose File / No file chosen" do navegador:
// clicar abre a escolha, arrastar e soltar também funciona, e o nome do escolhido fica à vista.
// O <input> de verdade continua na página (só escondido), com o mesmo id: o rótulo, o leitor
// de tela e o teclado (Tab, Enter ou Espaço) seguem funcionando.

const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * onArquivos(lista): chamado com os arquivos escolhidos ou soltos (um só, sem `multiple`).
 * escolhido: arquivo já escolhido (modo de um arquivo), para mostrar o nome e o "tirar".
 * onTirar: mostra o X ao lado do nome.
 */
export default function EscolherArquivo({ id, multiple = false, accept, disabled = false, onArquivos, escolhido = null, onTirar, inputRef, className = '', ...resto }) {
    const proprio = useRef(null);
    const ref = inputRef || proprio;
    const [sobre, setSobre] = useState(false);
    const entregar = (lista) => {
        const arquivos = [...(lista || [])];
        if (arquivos.length) onArquivos(multiple ? arquivos : arquivos.slice(0, 1));
    };
    return (
        <div className={className}>
            <input ref={ref} id={id} type="file" multiple={multiple} accept={accept} disabled={disabled} className="peer sr-only" {...resto}
                onChange={(e) => { const l = [...(e.target.files || [])]; e.target.value = ''; entregar(l); }} />
            <div
                onClick={() => !disabled && ref.current?.click()}
                onDragOver={(e) => { if (disabled) return; e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => { e.preventDefault(); setSobre(false); if (!disabled) entregar(e.dataTransfer?.files); }}
                className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-2 text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-900 ${sobre ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                {escolhido ? <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden /> : <Upload className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />}
                <span className="min-w-0 flex-1">
                    {escolhido ? (
                        <>
                            <span className="block truncate font-medium text-slate-900 dark:text-white">{escolhido.name}</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400">{tamanho(escolhido.size)} · clique para trocar</span>
                        </>
                    ) : (
                        <>
                            <span className="block font-medium text-slate-900 dark:text-white">{sobre ? 'Solte aqui' : multiple ? 'Escolher arquivos' : 'Escolher arquivo'}</span>
                            <span className="block text-xs text-slate-600 dark:text-slate-400 max-sm:hidden">ou arraste e solte aqui</span>
                        </>
                    )}
                </span>
                {escolhido && onTirar && (
                    <button type="button" aria-label={`Tirar o arquivo ${escolhido.name}`} onClick={(e) => { e.stopPropagation(); onTirar(); }}
                        className="-m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                )}
            </div>
        </div>
    );
}
