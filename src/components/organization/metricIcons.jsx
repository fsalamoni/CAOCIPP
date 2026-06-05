// ============================================================================
// metricIcons — mapa nome→componente (lucide) para os ícones das métricas
// ----------------------------------------------------------------------------
// Mantém a engine/cola de domínio livres de JSX. A allowlist de nomes vive em
// dashboardMetrics.js (METRIC_ICON_NAMES); aqui ficam os componentes.
// ============================================================================
import {
    FileText, Target, AlertTriangle, Clock, CheckCircle2, TrendingUp, TrendingDown,
    Users, User, DollarSign, Hash, Layers, Calendar, Activity, PieChart, BarChart3,
    Gauge, Flag, Inbox, Archive, Star, Zap, Award, ClipboardList, Scale, Briefcase,
    MapPin, Percent,
} from 'lucide-react';

export const METRIC_ICON_MAP = {
    FileText, Target, AlertTriangle, Clock, CheckCircle2, TrendingUp, TrendingDown,
    Users, User, DollarSign, Hash, Layers, Calendar, Activity, PieChart, BarChart3,
    Gauge, Flag, Inbox, Archive, Star, Zap, Award, ClipboardList, Scale, Briefcase,
    MapPin, Percent,
};

export function MetricIcon({ name, className }) {
    const Cmp = METRIC_ICON_MAP[name] || Hash;
    return <Cmp className={className} />;
}
