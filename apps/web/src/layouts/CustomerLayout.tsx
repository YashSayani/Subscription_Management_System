import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Layers,
  FileText,
  ShoppingBag,
  Wallet,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const CustomerLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'My Subscriptions', to: '/portal', icon: Layers, end: true },
    { label: 'Browse Products', to: '/portal/catalog', icon: ShoppingBag },
    { label: 'Billing & Invoices', to: '/portal/invoices', icon: FileText },
    { label: 'My Account & Credits', to: '/portal/profile', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Home className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white">Brightloop</span>
                <span className="block text-[10px] text-emerald-400 uppercase font-semibold tracking-wider">
                  Customer Portal
                </span>
              </div>
            </div>
          </div>

          {/* Credit Balance Badge */}
          <div className="m-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3 text-emerald-400" /> Available Credit
              </span>
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">
              ₹{Number(user?.creditBalance || 0).toFixed(2)}
            </div>
          </div>

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

        <div className="p-3 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="truncate mr-2">
              <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-400 inline" />
                Customer
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

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur px-8 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">Self-Service Account Workspace</h2>
          <div className="text-xs text-slate-400">
            {user?.companyName && <span className="font-medium text-slate-300 mr-2">{user.companyName}</span>}
            <span className="font-mono text-slate-500">[{user?.email}]</span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
