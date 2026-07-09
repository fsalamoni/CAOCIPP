// Status Colors Configuration - Definitive v1.12.0
// Unified source of truth for both badges and table rows
export const statusConfig = {
    'Pendente': {
        color: '#ffffff',
        label: 'Pendente',
        startColor: 'bg-white',
        text: 'text-slate-600',
        border: 'border-slate-200',
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
        startColor: 'bg-[#FFFF99]',
        text: 'text-amber-800',
        border: 'border-amber-200',
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
    'Em revisão': {
        color: '#8b5cf6',
        label: 'Em revisão',
        startColor: 'bg-[#B6DDE8]',
        text: 'text-indigo-800',
        border: 'border-indigo-200',
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
        startColor: 'bg-[#E5D9F5]',
        text: 'text-purple-800',
        border: 'border-purple-200',
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
        startColor: 'bg-[#D7E4BC]',
        text: 'text-green-800',
        border: 'border-green-200',
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
