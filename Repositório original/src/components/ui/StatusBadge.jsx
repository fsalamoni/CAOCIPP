import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';
import {
  Clock,
  FileText,
  Eye,
  RefreshCcw,
  PenTool,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const ICONS = {
  'Pendente': Clock,
  'Em elaboração': FileText,
  'Em revisão': Eye,
  'Na pasta': CheckCircle
};

export default function StatusBadge({ status, className, variant }) {
  const isNeutral = variant === 'neutral';
  const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
  const Icon = ICONS[status] || AlertCircle;

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border px-2.5 py-1 flex items-center gap-1.5 transition-colors",
        isNeutral
          ? "bg-slate-50 text-slate-600 border-slate-200"
          : cn(config.startColor, config.text, config.border || 'border-transparent'),
        className
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", isNeutral ? "text-slate-400" : "")} />
      {config.label || status}
    </Badge>
  );
}
