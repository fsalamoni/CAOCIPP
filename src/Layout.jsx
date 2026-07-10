import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations } from '@/hooks/useFirestore';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { getOrganizationTabs } from '@/lib/organizationModules';
import { hasAnyAdminPermission } from '@/constants/orgPermissions';
import { useEntityTypes } from '@/hooks/useCustomEntities';
import { formatPersonName } from '@/utils/nameUtils';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  User,
  Building2,
  HelpCircle,
  FileText,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ThemeToggleButton } from '@/lib/ThemeSwitcher';
import CommandPalette from '@/lib/CommandPalette';
import NotificationBell from '@/lib/NotificationBell';

import { useLocation } from 'react-router-dom';

const publicPages = ['Landing', 'Help', 'Terms'];
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'caocipp_sidebar_collapsed';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeOrgId = searchParams.get('id');
  const activeTab = searchParams.get('tab') || 'info';

  const { user, userProfile, signOut, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublicPage = publicPages.includes(currentPageName);

  /* Novo design (V2): sidebar colapsável, ficando apenas com os ícones. */
  const isV2 = useFlag(FEATURE_FLAGS.FRONTEND_V2.key);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
  );
  const isCollapsed = isV2 && collapsed;
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch { /* localStorage indisponível (modo privado etc.) — não é crítico */ }
      return next;
    });
  };

  // Fetch user organizations
  const { organizations } = useOrganizations(user?.uid);

  /* Super-admin de plataforma (controla a página Administração & Custos) */
  const { isPlatformAdmin } = usePlatformAdmin();

  /* Páginas/processos personalizados (liga/desliga de módulos por órgão) */
  const customEntitiesOn = useFlag(FEATURE_FLAGS.CUSTOM_ENTITIES.key);

  /* Calendário de vencimentos (aba extra no sub-menu do órgão). */
  const deadlineCalendarOn = useFlag(FEATURE_FLAGS.DEADLINE_CALENDAR.key);

  /* Tipos de entidade personalizados do órgão ativo (só quando a flag liga). */
  const { entityTypes: activeOrgCustomTypes } = useEntityTypes(
    customEntitiesOn ? activeOrgId : null
  );

  const handleLogout = async () => {
    await signOut();
    window.location.href = createPageUrl('Landing');
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !user) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">{children}</div>;
  }

  // Display Name logic (Profile > Auth > Email)
  const rawDisplayName = userProfile?.platform_name || user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const displayName = formatPersonName(rawDisplayName);
  const displayEmail = userProfile?.email || user?.email;
  const initial = displayName?.[0]?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <CommandPalette />
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Processos</h1>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <NotificationBell variant="mobile" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <TooltipProvider delayDuration={200}>
        <aside className={cn(
          'fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 w-64',
          'transform transition-[width,transform] duration-200 ease-in-out z-40',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          isCollapsed && 'lg:w-[76px]'
        )}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={cn('h-16 flex items-center border-b border-slate-200 dark:border-slate-700', isCollapsed ? 'justify-center px-0' : 'px-6')}>
              {isCollapsed ? (
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  CC
                </div>
              ) : (
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  Consultas CAO
                </h1>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              <div className="space-y-1">
                <NavItem
                  to="Dashboard"
                  icon={LayoutDashboard}
                  label="Início"
                  active={currentPageName === 'Dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="Profile"
                  icon={User}
                  label="Meu Perfil"
                  active={currentPageName === 'Profile'}
                  onClick={() => setSidebarOpen(false)}
                  collapsed={isCollapsed}
                />
              </div>

              {/* Organizations Section */}
              {organizations.length > 0 && (
                <>
                  {!isCollapsed && (
                    <div className="mt-6 mb-2 px-3">
                      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Órgãos
                      </h3>
                    </div>
                  )}
                  {isCollapsed && <div className="mt-6" />}
                  <div className="space-y-1">
                    {organizations.map(org => {
                      const isOrgActive = currentPageName === 'Organization' && activeOrgId === org.id;

                      return (
                        <div key={org.id}>
                          <NavItem
                            to="Organization"
                            params={`?id=${org.id}`}
                            icon={Building2}
                            label={org.name}
                            active={isOrgActive}
                            onClick={() => setSidebarOpen(false)}
                            badge={org.userRole === 'creator' ? 'Criador' : null}
                            collapsed={isCollapsed}
                          />

                          {/* Sub-navigation for active organization (oculta quando colapsada, como no protótipo) */}
                          {isOrgActive && !isCollapsed && (
                            <div className="mt-1 ml-4 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1">
                              {getOrganizationTabs(org, { customEntitiesOn, customTypes: isOrgActive ? activeOrgCustomTypes : [], deadlineCalendarOn })
                                .filter((tab) => !tab.creatorOnly || org.userRole === 'creator' || hasAnyAdminPermission({ role: org.userRole, permissions: org.userPermissions }))
                                .map((tab) => {
                                  const TabIcon = tab.icon;
                                  return (
                                    <SubNavItem
                                      key={tab.key}
                                      to="Organization"
                                      params={`?id=${org.id}&tab=${tab.key}`}
                                      icon={TabIcon}
                                      label={tab.label}
                                      active={activeTab === tab.key}
                                      onClick={() => setSidebarOpen(false)}
                                    />
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-6 space-y-1">
                {isPlatformAdmin && (
                  <NavItem
                    to="Admin"
                    icon={ShieldCheck}
                    label="Administração & Custos"
                    active={currentPageName === 'Admin'}
                    onClick={() => setSidebarOpen(false)}
                    collapsed={isCollapsed}
                  />
                )}
                <NavItem
                  to="Help"
                  icon={HelpCircle}
                  label="Ajuda"
                  active={currentPageName === 'Help'}
                  onClick={() => setSidebarOpen(false)}
                  collapsed={isCollapsed}
                />
                <NavItem
                  to="Terms"
                  icon={FileText}
                  label="Termos de Uso"
                  active={currentPageName === 'Terms'}
                  onClick={() => setSidebarOpen(false)}
                  collapsed={isCollapsed}
                />
              </div>
            </nav>

            {/* Collapse toggle (somente no novo design V2) */}
            {isV2 && (
              <div className={cn('hidden lg:flex border-t border-slate-200 dark:border-slate-700 py-2', isCollapsed ? 'justify-center' : 'justify-end px-2')}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleCollapsed}
                      className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-muted"
                      aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{isCollapsed ? 'Expandir menu' : 'Recolher menu'}</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* User Section */}
            <div className={cn('p-4 border-t border-slate-200 dark:border-slate-700', isCollapsed && 'flex justify-center p-3')}>
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-sm hover:opacity-90 transition-opacity"
                      title="Sair"
                    >
                      {initial}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{displayName} · Sair</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-sm shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={displayEmail}>{displayEmail}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/40" aria-label="Sair da conta">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>

      {/* Main Content */}
      <div className={cn('min-h-screen transition-[margin] duration-200 ease-in-out', isCollapsed ? 'lg:ml-[76px]' : 'lg:ml-64')}>
        {/* Top Bar - Desktop */}
        <div className="hidden lg:flex h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 items-center justify-between px-6 sticky top-0 z-30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {currentPageName === 'Dashboard' ? 'Painel de Consultas' :
              currentPageName === 'Profile' ? 'Meu Perfil' :
                currentPageName === 'Organization' ? 'Órgão' :
                  currentPageName}
          </h2>
          <div className="flex items-center gap-1">
          <ThemeToggleButton />
          <NotificationBell />
          </div>
        </div>

        {/* Page Content */}
        <main className="p-6 mt-16 lg:mt-0">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function NavItem({ to, params = '', icon: Icon, label, active, badge, onClick, collapsed = false }) {
  const link = (
    <Link
      to={createPageUrl(to) + params}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
          {badge && !active && (
            <Badge variant="secondary" className="text-[10px] px-1 h-4">
              {badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SubNavItem({ to, params = '', icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={createPageUrl(to) + params}
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all text-xs
        ${active
          ? 'bg-slate-100 dark:bg-slate-800 text-primary font-semibold'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
        }
      `}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : ''}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
