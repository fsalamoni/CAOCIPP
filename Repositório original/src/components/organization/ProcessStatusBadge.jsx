import React from 'react';
import { 
  Clock, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  FolderArchive
} from 'lucide-react';

export default function ProcessStatusBadge({ status }) {
  const statusConfig = {
    'Em triagem': { 
      color: 'bg-slate-100 text-slate-700 border-slate-300', 
      icon: Clock 
    },
    'Pendente': { 
      color: 'bg-amber-100 text-amber-700 border-amber-300', 
      icon: Clock 
    },
    'Em elaboração': { 
      color: 'bg-blue-100 text-blue-700 border-blue-300', 
      icon: FileText 
    },
    'Em revisão': { 
      color: 'bg-violet-100 text-violet-700 border-violet-300', 
      icon: FileText 
    },
    'Para revisão': { 
      color: 'bg-pink-100 text-pink-700 border-pink-300', 
      icon: AlertCircle 
    },
    'Na pasta': { 
      color: 'bg-emerald-100 text-emerald-700 border-emerald-300', 
      icon: CheckCircle 
    }
  };

  const config = statusConfig[status] || statusConfig['Em triagem'];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}