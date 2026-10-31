import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Layers, ShieldCheck } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Subtle radial glow background effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-8 text-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all">
            <Layers className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="font-bold text-xl tracking-tight text-white block">Brightloop</span>
            <span className="text-xs text-slate-400 block -mt-1">Subscription Engine</span>
          </div>
        </Link>
      </div>

      {/* Auth Card Container */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          <Outlet />
        </div>
      </div>

      {/* Security note footer */}
      <div className="mt-8 text-center text-xs text-slate-500 flex items-center gap-1.5 relative z-10">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
        <span>Dual-token HttpOnly SameSite=Strict cookies • Real-time DB sync</span>
      </div>
    </div>
  );
};
