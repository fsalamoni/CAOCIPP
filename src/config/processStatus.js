// Status Colors Configuration - Definitive v1.12.0
// Unified source of truth for both badges and table rows
export const statusConfig = {
    'Pendente': {
        color: '#ffffff',
        label: 'Pendente',
        startColor: 'bg-white dark:bg-slate-700',
        text: 'text-slate-600 dark:text-slate-100',
        border: 'border-slate-200 dark:border-slate-500',
        row: {
            bg: "bg-white",
            accent: "border-l-slate-200",
            border: "border-b-slate-100",
            hover: "hover:bg-slate-50",
            groupHover: "group-hover:!bg-slate-50"
        },
        // V2 (design minimalista): linha branca/neutra + fina borda de acento à
        // esquerda, em vez do preenchimento colorido inteiro da linha (V1).
        // Mesma paleta usada nas colunas do Kanban, para consistência entre as duas visões.
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-slate-300",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
    'Em elaboração': {
        color: '#fbbf24',
        label: 'Em elaboração',
        startColor: 'bg-[#FFFF99] dark:bg-amber-800',
        text: 'text-amber-800 dark:text-amber-100',
        border: 'border-amber-200 dark:border-amber-500',
        row: {
            bg: "bg-[#FFFF99]",
            accent: "border-l-[#F1C232]",
            border: "border-b-[#E1E17F]",
            hover: "hover:bg-[#F0F08B]",
            groupHover: "group-hover:!bg-[#F0F08B]"
        },
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-amber-400",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
    'Aguarda retorno de terceiros': {
        color: '#06b6d4',
        label: 'Aguarda retorno de terceiros',
        startColor: 'bg-[#CFF4FC] dark:bg-cyan-800',
        text: 'text-cyan-800 dark:text-cyan-100',
        border: 'border-cyan-200 dark:border-cyan-500',
        row: {
            bg: "bg-[#CFF4FC]",
            accent: "border-l-[#3AB7CC]",
            border: "border-b-[#A9E1EC]",
            hover: "hover:bg-[#BEEBF5]",
            groupHover: "group-hover:!bg-[#BEEBF5]"
        },
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-cyan-400",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
    'Em revisão': {
        color: '#8b5cf6',
        label: 'Em revisão',
        startColor: 'bg-[#B6DDE8] dark:bg-sky-800',
        text: 'text-indigo-800 dark:text-sky-100',
        border: 'border-indigo-200 dark:border-sky-500',
        row: {
            bg: "bg-[#B6DDE8]",
            accent: "border-l-[#6FA8DC]",
            border: "border-b-[#9BBDC6]",
            hover: "hover:bg-[#A5C9D4]",
            groupHover: "group-hover:!bg-[#A5C9D4]"
        },
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-sky-400",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
    'Revisadas': {
        color: '#a855f7',
        label: 'Revisadas',
        startColor: 'bg-[#E5D9F5] dark:bg-violet-800',
        text: 'text-purple-800 dark:text-violet-100',
        border: 'border-purple-200 dark:border-violet-500',
        row: {
            bg: "bg-[#E5D9F5]",
            accent: "border-l-[#8E7CC3]",
            border: "border-b-[#D3C2EC]",
            hover: "hover:bg-[#DCCDF0]",
            groupHover: "group-hover:!bg-[#DCCDF0]"
        },
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-violet-400",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
    'Na pasta': {
        color: '#22c55e',
        label: 'Na pasta',
        startColor: 'bg-[#D7E4BC] dark:bg-green-800',
        text: 'text-green-800 dark:text-green-100',
        border: 'border-green-200 dark:border-green-500',
        row: {
            bg: "bg-[#D7E4BC]",
            accent: "border-l-[#93C47D]",
            border: "border-b-[#C2D0A5]",
            hover: "hover:bg-[#C9D6AF]",
            groupHover: "group-hover:!bg-[#C9D6AF]"
        },
        rowV2: {
            bg: "bg-white dark:bg-slate-900",
            accent: "border-l-emerald-400",
            border: "border-b-border",
            hover: "hover:bg-muted/60",
            groupHover: "group-hover:!bg-muted/60"
        }
    },
};

export const DEFAULT_STATUS_CONFIG = statusConfig['Pendente'];
