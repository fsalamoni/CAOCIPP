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
        }
    },
};

export const DEFAULT_STATUS_CONFIG = statusConfig['Pendente'];
