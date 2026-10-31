import React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Layers,
  FileText,
  CreditCard,
  Package,
  Tag,
  Users,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  const quickNav = [
    {
      title: 'Products & Plans Catalog',
      desc: 'Configure subscription products, pricing variants, add-ons, and billing cycles.',
      to: '/admin/catalog',
      icon: Package,
      tag: 'Catalog',
    },
    {
      title: 'Subscription Lifecycle',
      desc: 'Inspect Drafts, Quotations, Active, Paused, and Closed subscription agreements.',
      to: '/admin/subscriptions',
      icon: Layers,
      tag: 'Lifecycle',
    },
    {
      title: 'Invoices & Billing',
      desc: 'View automated recurring invoices, tax snapshots, and payment status tracking.',
      to: '/admin/invoices',
      icon: FileText,
      tag: 'Billing',
    },
    {
      title: 'Payments & Credit Balances',
      desc: 'Record manual bank payments, allocate against invoices, and track customer credit.',
      to: '/admin/payments',
      icon: CreditCard,
      tag: 'Ledger',
    },
    {
      title: 'Discounts & Promotions',
      desc: 'Configure fixed/percentage discounts with atomic concurrent usage counters.',
      to: '/admin/discounts',
      icon: Tag,
      tag: 'Discounts',
    },
    {
      title: 'Staff Management',
      desc: 'Provision internal staff accounts with granular operational permissions.',
      to: '/admin/staff',
      icon: Users,
      tag: 'Access',
    },
    {
      title: 'System Diagnostics',
      desc: 'Inspect live PostgreSQL database connectivity, latency, and server uptime.',
      to: '/admin/diagnostics',
      icon: Activity,
      tag: 'Infra',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Overview</h1>
            <Badge variant="success">Admin Access</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Welcome back, <span className="text-slate-200 font-medium">{user?.fullName}</span>. Complete visibility and control over Brightloop's subscription infrastructure.
          </p>
        </div>
        <Link
          to="/admin/diagnostics"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition w-fit"
        >
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span>PostgreSQL Health Synced</span>
        </Link>
      </div>

      {/* High-Level Financial & Subscription Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Monthly Recurring Rev (MRR)</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">₹0.00</div>
            <p className="text-[10px] text-slate-500 mt-1">Normalized active subscription value</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Annual Recurring Rev (ARR)</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">₹0.00</div>
            <p className="text-[10px] text-slate-500 mt-1">Annualized contract value</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Subscriptions</span>
              <Layers className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">0</div>
            <p className="text-[10px] text-slate-500 mt-1">In ACTIVE billing state</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Outstanding Invoices</span>
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">₹0.00</div>
            <p className="text-[10px] text-slate-500 mt-1">Unsettled confirmed invoice balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules & Feature Sections */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Management Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge variant="neutral" size="sm">
                      {item.tag}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400 group-hover:text-emerald-400 font-medium">
                  <span>Enter</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
