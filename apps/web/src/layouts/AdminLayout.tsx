import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  FileText,
  CreditCard,
  Tag,
  Users,
  Activity,
  LogOut,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Catalog & Plans', to: '/admin/catalog', icon: Package },
    { label: 'Subscriptions', to: '/admin/subscriptions', icon: Layers },
    { label: 'Invoices', to: '/admin/invoices', icon: FileText },
    { label: 'Payments', to: '/admin/payments', icon: CreditCard },
    { label: 'Discounts', to: '/admin/discounts', icon: Tag },
    { label: 'Customers', to: '/admin/customers', icon: UserCheck },
    { label: 'Staff Management', to: '/admin/staff', icon: Users },
    { label: 'System Diagnostics', to: '/admin/diagnostics', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo / Header */}
          <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white">Brightloop</span>
                <span className="block text-[10px] text-emerald-400 uppercase font-semibold tracking-wider">
                  Admin Console
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="truncate mr-2">
              <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-rose-400 inline" />
                Administrator
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-md hover:bg-slate-800 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-medium text-slate-400">Environment:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PostgreSQL 18 Local
            </span>
          </div>
          <div className="text-xs text-slate-400">
            Logged in as <span className="text-slate-200 font-medium">{user?.email}</span>
          </div>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
