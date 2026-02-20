import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations, useNotifications } from '@/hooks/useFirestore';
import {
  LayoutDashboard,
  User,
  Building2,
  HelpCircle,
  FileText,
  LogOut,
  Bell,
  Menu,
  X,
  Search,
  Sparkles,
  Settings,
  Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { useLocation } from 'react-router-dom';

const publicPages = ['Landing', 'Help', 'Terms'];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeOrgId = searchParams.get('id');
  const activeTab = searchParams.get('tab') || 'info';

  const { user, userProfile, signOut, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublicPage = publicPages.includes(currentPageName);

  // Fetch user organizations
  const { organizations } = useOrganizations(user?.uid);

  /* Notifications Hook */
  const { notifications } = useNotifications();

  const handleLogout = async () => {
    await signOut();
    window.location.href = createPageUrl('Landing');
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated || !user) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">{children}</div>;
  }

  // Display Name logic (Profile > Auth > Email)
  const displayName = userProfile?.platform_name || user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const displayEmail = userProfile?.email || user?.email;
  const initial = displayName?.[0]?.toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold text-slate-800">Processos</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2 font-semibold">Notificações</div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Nenhuma notificação</div>
              ) : (
                notifications.slice(0, 5).map(notif => (
                  <DropdownMenuItem key={notif.id} className="flex-col items-start p-3 cursor-pointer hover:bg-slate-50">
                    <div className="font-medium text-sm text-slate-900">{notif.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{notif.message}</div>
                    <div className="text-[10px] text-slate-400 mt-2 w-full text-right">
                      {new Date(notif.created_at?.seconds * 1000).toLocaleString()}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-200 ease-in-out z-40
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Consultas CAO
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              <NavItem
                to="Dashboard"
                icon={LayoutDashboard}
                label="Início"
                active={currentPageName === 'Dashboard'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="Profile"
                icon={User}
                label="Meu Perfil"
                active={currentPageName === 'Profile'}
                onClick={() => setSidebarOpen(false)}
              />
            </div>

            {/* Organizations Section */}
            {organizations.length > 0 && (
              <>
                <div className="mt-6 mb-2 px-3">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Órgãos
                  </h3>
                </div>
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
                        />

                        {/* Sub-navigation for active organization */}
                        {isOrgActive && (
                          <div className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-1">
                            <SubNavItem
                              to="Organization"
                              params={`?id=${org.id}&tab=info`}
                              icon={Building2}
                              label="Informações Gerais"
                              active={activeTab === 'info'}
                              onClick={() => setSidebarOpen(false)}
                            />
                            <SubNavItem
                              to="Organization"
                              params={`?id=${org.id}&tab=kanban`}
                              icon={LayoutDashboard}
                              label="Painel de Controle"
                              active={activeTab === 'kanban'}
                              onClick={() => setSidebarOpen(false)}
                            />
                            <SubNavItem
                              to="Organization"
                              params={`?id=${org.id}&tab=processes`}
                              icon={Search}
                              label="Consultas"
                              active={activeTab === 'processes'}
                              onClick={() => setSidebarOpen(false)}
                            />
                            <SubNavItem
                              to="Organization"
                              params={`?id=${org.id}&tab=summary`}
                              icon={Sparkles}
                              label="Resumos Inteligentes"
                              active={activeTab === 'summary'}
                              onClick={() => setSidebarOpen(false)}
                            />
                            {org.userRole === 'creator' && (
                              <SubNavItem
                                to="Organization"
                                params={`?id=${org.id}&tab=admin`}
                                icon={Settings}
                                label="Painel Administrativo"
                                active={activeTab === 'admin'}
                                onClick={() => setSidebarOpen(false)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="mt-6 space-y-1">
              <NavItem
                to="Help"
                icon={HelpCircle}
                label="Ajuda"
                active={currentPageName === 'Help'}
                onClick={() => setSidebarOpen(false)}
              />
              <NavItem
                to="Terms"
                icon={FileText}
                label="Termos de Uso"
                active={currentPageName === 'Terms'}
                onClick={() => setSidebarOpen(false)}
              />
            </div>
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-sm">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate" title={displayEmail}>{displayEmail}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top Bar - Desktop */}
        <div className="hidden lg:flex h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200 items-center justify-between px-6 sticky top-0 z-30">
          <h2 className="text-lg font-semibold text-slate-800">
            {currentPageName === 'Dashboard' ? 'Painel de Controle' :
              currentPageName === 'Profile' ? 'Meu Perfil' :
                currentPageName === 'Organization' ? 'Órgão' :
                  currentPageName}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2 font-semibold">Notificações</div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Nenhuma notificação</div>
              ) : (
                notifications.slice(0, 5).map(notif => (
                  <DropdownMenuItem key={notif.id} className="flex-col items-start p-3">
                    <div className="font-medium text-sm">{notif.title}</div>
                    <div className="text-xs text-slate-500">{notif.message}</div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

function NavItem({ to, params = '', icon: Icon, label, active, badge, onClick }) {
  return (
    <Link
      to={createPageUrl(to) + params}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
        ${active
          ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md'
          : 'text-slate-700 hover:bg-slate-100'
        }
      `}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      {badge && !active && (
        <Badge variant="secondary" className="text-[10px] px-1 h-4">
          {badge}
        </Badge>
      )}
    </Link>
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
          ? 'bg-slate-100 text-primary font-semibold'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }
      `}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-primary' : ''}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}