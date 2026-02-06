import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  LayoutDashboard, 
  User, 
  Building2, 
  HelpCircle, 
  FileText, 
  LogOut, 
  Bell,
  Menu,
  X
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

const publicPages = ['Landing', 'Help', 'Terms'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPublicPage = publicPages.includes(currentPageName);

  useEffect(() => {
    const getUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      }
    };
    if (!isPublicPage) {
      getUser();
    }
  }, [isPublicPage]);

  // Buscar organizações do usuário
  const { data: organizations = [] } = useQuery({
    queryKey: ['user-organizations'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getUserOrganizations', {});
      return response.data.organizations || [];
    },
    enabled: !!user,
    initialData: []
  });

  // Buscar notificações não lidas
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.id, read: false }),
    enabled: !!user,
    initialData: []
  });

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!user) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">{children}</div>;
  }

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
                  <DropdownMenuItem key={notif.id} className="flex-col items-start p-3">
                    <div className="font-medium text-sm">{notif.title}</div>
                    <div className="text-xs text-slate-500">{notif.message}</div>
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
              Processos
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
                  {organizations.map(org => (
                    <NavItem 
                      key={org.id}
                      to="Organization"
                      params={`?id=${org.id}`}
                      icon={Building2} 
                      label={org.name} 
                      active={currentPageName === 'Organization' && window.location.search.includes(org.id)}
                      onClick={() => setSidebarOpen(false)}
                      badge={org.userRole === 'creator' ? 'Criador' : null}
                    />
                  ))}
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
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                  {user?.platform_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{user?.platform_name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0">
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
      <span className="text-sm font-medium flex-1">{label}</span>
      {badge && !active && (
        <Badge variant="secondary" className="text-xs">
          {badge}
        </Badge>
      )}
    </Link>
  );
}