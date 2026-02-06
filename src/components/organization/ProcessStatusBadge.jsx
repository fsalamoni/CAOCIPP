import React from 'react';
import {
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  FolderArchive
} from 'lucide-react';
import { statusConfig, DEFAULT_STATUS_CONFIG } from '@/config/processStatus';

const ICONS = {
  'Em triagem': Clock,
  'Pendente': Clock,
  'Em elaboração': FileText,
  'Em revisão': FileText,
  'Para revisão': AlertCircle, // Note: 'Para revisão' might act like 'Para assinatura' or be distinct. I'll map 'Para assinatura' if needed.
  'Para assinatura': AlertCircle,
  'Na pasta': CheckCircle
};

export default function ProcessStatusBadge({ status }) {
  const config = statusConfig[status] || DEFAULT_STATUS_CONFIG;
  // Fallback for icon if not in map
  let Icon = ICONS[status] || FileText;

  // Construct className from shared config parts
  // The shared config has startColor (bg), text, and border.
  // We need to combine them.
  const className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.startColor} ${config.text} ${config.border || 'border-transparent'}`;

  return (
    <span className={className}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}