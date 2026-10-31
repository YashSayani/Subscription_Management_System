import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  FileText,
  ShoppingBag,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Customer Portal</h1>
            <Badge variant="success">Active Account</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Welcome back, <span className="text-slate-200 font-medium">{user?.fullName}</span>
            {user?.companyName ? ` (${user.companyName})` : ''}. Review your subscriptions, view invoices, and manage credits.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <ShieldCheck className="h-4 w-4" />
          <span>Secure Customer Workspace</span>
        </div>
      </div>

      {/* Account Balance & Subscriptions Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Credit Balance Card */}
        <Card className="bg-slate-900/40 border-emerald-500/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Available Credit Balance</span>
              <Wallet className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
              ₹{Number(user?.creditBalance || 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Automatically offsets upcoming invoices</p>
          </CardContent>
        </Card>

        {/* Active Subscriptions Card */}
        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Subscriptions</span>
              <Layers className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">0</div>
            <p className="text-[10px] text-slate-500 mt-1">Currently renewing agreements</p>
          </CardContent>
        </Card>

        {/* Open Invoices Card */}
        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Unpaid Invoices</span>
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">₹0.00</div>
            <p className="text-[10px] text-slate-500 mt-1">Due for settlement</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/portal/catalog"
          className="group p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition flex flex-col justify-between"
        >
          <div>
            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition mb-3">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">
              Browse Catalog & Plans
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Explore available subscription software packages, brand add-ons, and billing cycles.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400 group-hover:text-emerald-400 font-medium">
            <span>Explore</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          to="/portal/invoices"
          className="group p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition flex flex-col justify-between"
        >
          <div>
            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition mb-3">
              <FileText className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">
              Invoices & Statements
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Review recurring tax invoices, payment receipts, and download PDF-ready statements.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400 group-hover:text-emerald-400 font-medium">
            <span>View Invoices</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        <Link
          to="/portal/profile"
          className="group p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition flex flex-col justify-between"
        >
          <div>
            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition mb-3">
              <Building className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">
              Billing & Account Info
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Manage billing tax IDs, physical invoicing address, and customer credit ledger.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400 group-hover:text-emerald-400 font-medium">
            <span>Account Details</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </div>
    </div>
  );
};
