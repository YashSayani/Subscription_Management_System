import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  FileText,
  CreditCard,
  Package,
  ArrowRight,
  Briefcase,
  Wallet,
} from 'lucide-react';
import { AnalyticsOverviewDto, AgingReportDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();

  // 1. Fetch live Overview Metrics
  const { data: overview, isLoading: isOverviewLoading } = useQuery<AnalyticsOverviewDto>({
    queryKey: ['staff-analytics-overview'],
    queryFn: async () => {
      const res = await apiClient.get('/api/analytics/overview');
      return res.data.data;
    },
  });

  // 2. Fetch live Aging Report
  const { data: aging } = useQuery<AgingReportDto>({
    queryKey: ['staff-analytics-aging'],
    queryFn: async () => {
      const res = await apiClient.get('/api/analytics/aging');
      return res.data.data;
    },
  });

  const operationalNav = [
    {
      title: 'Quotations & Subscriptions',
      desc: 'Draft quotes from customer selections, apply eligible discounts, and convert to active subscriptions.',
      to: '/staff/subscriptions',
      icon: Layers,
      tag: 'Orders',
    },
    {
      title: 'Invoices & Statements',
      desc: 'Inspect customer billing schedules, track payment due dates, and view settlement statuses.',
      to: '/staff/invoices',
      icon: FileText,
      tag: 'Invoicing',
    },
    {
      title: 'Record Payments',
      desc: 'Log manual bank transfers, cheques, and cash receipts; allocate directly to open invoices.',
      to: '/staff/payments',
      icon: CreditCard,
      tag: 'Payments',
    },
    {
      title: 'Products & Plans Catalog',
      desc: 'Browse available products, brand variants, configurable add-ons, and subscription intervals.',
      to: '/staff/catalog',
      icon: Package,
      tag: 'Catalog',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Staff Operations Workspace</h1>
            <Badge variant="info">Staff Access</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Signed in as <span className="text-slate-200 font-medium">{user?.fullName}</span>. Manage customer quotes, active subscriptions, and payment collection ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <Briefcase className="h-4 w-4 text-blue-400" />
          <span>Operational Monolith</span>
        </div>
      </div>

      {/* Operational Metric Tiles */}
      {isOverviewLoading ? (
        <div className="py-8 flex justify-center">
          <LoadingSpinner message="Loading operational metrics..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active SaaS Subscriptions</span>
                <Layers className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-2">
                {overview?.activeSubscriptionsCount || 0}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                MRR: ₹{Number(overview?.mrr || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card className={`border ${Number(overview?.overdueBalance || 0) > 0 ? 'bg-rose-950/20 border-rose-800/40' : 'bg-slate-900/60 border-slate-800'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Outstanding Debtor Balance</span>
                <FileText className={`h-4 w-4 ${Number(overview?.overdueBalance || 0) > 0 ? 'text-rose-400' : 'text-amber-400'}`} />
              </div>
              <div className={`text-2xl font-bold font-mono mt-2 ${Number(overview?.overdueBalance || 0) > 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                ₹{Number(overview?.outstandingArBalance || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {overview?.overdueInvoicesCount || 0} invoices past due date
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Collections Settled</span>
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                ₹{Number(overview?.totalRevenueCollected || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Logged across bank & cash receipts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AR Aging Overview for Follow-Ups */}
      {aging && (
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wider uppercase">
                Payment Follow-Up Queue by Aging Bracket
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Prioritize collections follow-up for invoices past due date.
              </p>
            </div>
            <Link
              to="/staff/invoices"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>Manage Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {aging.brackets.map((b) => (
              <div
                key={b.bracket}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800/80"
              >
                <span className="text-[10px] text-slate-400 block truncate">{b.label}</span>
                <span className="text-sm font-bold font-mono text-white mt-1 block">
                  ₹{Number(b.totalAmount).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">{b.count} inv</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Operational Modules */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Operations & Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {operationalNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group p-5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:text-blue-400 group-hover:border-blue-500/30 transition">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge variant="neutral" size="sm">
                      {item.tag}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400 group-hover:text-blue-400 font-medium">
                  <span>Open</span>
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
