import React from 'react';
import { cn } from "@/lib/utils";
import { FolderSearch } from "lucide-react";

export default function EmptyState({
    icon: Icon = FolderSearch,
    title = "Nenhum resultado encontrado",
    description = "Tente ajustar seus filtros para encontrar o que procura.",
    action,
    className
}) {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500", className)}>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full border border-slate-100 dark:border-slate-800 mb-4 shadow-sm">
                <Icon className="w-12 h-12 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
                {description}
            </p>
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
}
