import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileType2, FileJson, FileCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
    exportTableToExcel,
    exportTableToPdf,
    exportTableToDoc,
    exportTableToMarkdown,
    exportTableToCsv,
    exportToJson,
    dateSuffix,
} from '@/lib/jurimetriaExport';

/**
 * Menu único de exportação usado por todas as abas da Jurimetria.
 * Recebe as linhas JÁ filtradas e ordenadas, junto com a definição textual das
 * colunas — assim o arquivo gerado reflete exatamente o que está na tela.
 *
 * @param {object} props
 * @param {Array<object>} props.rows
 * @param {Array<{label:string, key?:string, value?:(row:object)=>any}>} props.columns
 * @param {string} props.filenameBase Nome do arquivo, sem extensão nem data.
 * @param {string} props.title Título impresso no PDF/Word/Markdown.
 * @param {string} [props.subtitle] Linha de contexto (filtros aplicados, período).
 * @param {Array<object>} [props.jsonData] Conteúdo do .json (padrão: `rows`).
 * @param {boolean} [props.disabled]
 * @param {string} [props.size]
 * @param {string} [props.variant]
 * @param {string} [props.label]
 */
export default function JurimetriaExportMenu({
    rows = [],
    columns = [],
    filenameBase = 'jurimetria',
    title = 'Jurimetria',
    subtitle = '',
    jsonData = null,
    disabled = false,
    size = 'sm',
    variant = 'outline',
    label = 'Exportar',
}) {
    const [busy, setBusy] = useState(null);

    const filename = `${filenameBase}-${dateSuffix()}`;
    const isEmpty = !rows || rows.length === 0;

    const run = async (format, fn) => {
        if (isEmpty) {
            toast.error('Não há dados para exportar com os filtros atuais.');
            return;
        }
        setBusy(format);
        try {
            // Cede um quadro ao navegador para o estado de carregamento aparecer
            // antes de uma geração pesada travar a thread principal.
            await new Promise((resolve) => setTimeout(resolve, 0));
            fn();
            toast.success(`Arquivo ${format} gerado.`);
        } catch (error) {
            logger.error(`[jurimetria] falha ao exportar ${format}:`, error);
            toast.error(`Não foi possível gerar o arquivo ${format}.`);
        } finally {
            setBusy(null);
        }
    };

    const options = [
        {
            format: 'Excel',
            icon: FileSpreadsheet,
            hint: '.xlsx — planilha com uma coluna por campo',
            action: () => exportTableToExcel({ rows, columns, filenameBase: filename, sheetName: 'Júris' }),
        },
        {
            format: 'PDF',
            icon: FileText,
            hint: '.pdf — documento pronto para impressão',
            action: () => exportTableToPdf({ rows, columns, filenameBase: filename, title, subtitle }),
        },
        {
            format: 'Word',
            icon: FileType2,
            hint: '.doc — tabela editável no Word',
            action: () => exportTableToDoc({ rows, columns, filenameBase: filename, title, subtitle }),
        },
        {
            format: 'Markdown',
            icon: FileCode,
            hint: '.md — texto puro para wikis e documentos',
            action: () => exportTableToMarkdown({ rows, columns, filenameBase: filename, title, subtitle }),
        },
        {
            format: 'CSV',
            icon: FileSpreadsheet,
            hint: '.csv — separado por ponto e vírgula',
            action: () => exportTableToCsv({ rows, columns, filenameBase: filename }),
        },
        {
            format: 'JSON',
            icon: FileJson,
            hint: '.json — dados brutos para backup e integração',
            action: () => exportToJson({ data: jsonData || rows, filenameBase: filename }),
        },
    ];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={variant} size={size} className="gap-2" disabled={disabled || isEmpty}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    {rows.length.toLocaleString('pt-BR')} registro(s) — respeita os filtros aplicados
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {options.map((option) => {
                    const Icon = option.icon;
                    return (
                        <DropdownMenuItem
                            key={option.format}
                            onSelect={(event) => {
                                event.preventDefault();
                                run(option.format, option.action);
                            }}
                            className="gap-2 items-start py-2"
                        >
                            <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-500 dark:text-slate-400" />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{option.format}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
                            </span>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
