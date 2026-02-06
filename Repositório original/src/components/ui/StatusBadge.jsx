import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  "Em triagem": { color: "bg-slate-100 text-slate-700 border-slate-200", icon: "⏳" },
  "Pendente": { color: "bg-amber-100 text-amber-700 border-amber-200", icon: "📋" },
  "Em elaboração": { color: "bg-blue-100 text-blue-700 border-blue-200", icon: "✏️" },
  "Em revisão": { color: "bg-purple-100 text-purple-700 border-purple-200", icon: "👁️" },
  "Para revisão": { color: "bg-orange-100 text-orange-700 border-orange-200", icon: "🔄" },
  "Na pasta": { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "✅" }
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || statusConfig["Em triagem"];
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium border px-2.5 py-1",
        config.color,
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {status}
    </Badge>
  );
}

export function calculateStatus(process) {
  if (process.archived_date) return "Na pasta";
  if (process.review_return_date) return "Para revisão";
  if (process.review_submission_date) return "Em revisão";
  if (process.analysis_start_date) return "Em elaboração";
  if (process.distribution_date) return "Pendente";
  return "Em triagem";
}