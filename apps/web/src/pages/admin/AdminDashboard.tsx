import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { AnalyticsOverviewDto, AgingReportDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  // 1. Fetch live Analytics Overview
  const { data: overview, isLoading: isOverviewLoading } = useQuery<AnalyticsOverviewDto>({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await apiClient.get('/api/analytics/overview');
      return res.data.data;
    },
  });

  // 2. Fetch live AR Aging Report
  const { data: aging, isLoading: isAgingLoading } = useQuery<AgingReportDto>({
    queryKey: ['analytics-aging'],
    queryFn: async () => {
      const res = await apiClient.get('/api/analytics/aging');
      return res.data.data;
    },
  });

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
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Executive Overview</h1>
            <Badge variant="success">Admin Access</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Welcome back, <span className="text-slate-200 font-medium">{user?.fullName}</span>. Complete visibility and real-time financial analytics over Brightloop&apos;s subscription engine.
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

      {/* Real-time KPI Metric Tiles */}
      {isOverviewLoading ? (
        <div className="py-8 flex justify-center">
          <LoadingSpinner message="Calculating financial metrics..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Monthly Recurring Rev (MRR)</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-2">
                ₹{Number(overview?.mrr || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Normalized active subscription revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Annual Recurring Rev (ARR)</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-2">
                ₹{Number(overview?.arr || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Annualized contract run-rate</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Collected Revenue</span>
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                ₹{Number(overview?.totalRevenueCollected || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Recorded & settled payments</p>
            </CardContent>
          </Card>

          <Card className={`border ${Number(overview?.overdueBalance || 0) > 0 ? 'bg-rose-950/20 border-rose-800/50' : 'bg-slate-900/60 border-slate-800'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-xs">
                <span className={Number(overview?.overdueBalance || 0) > 0 ? 'text-rose-400 font-medium' : 'text-slate-400'}>
                  Outstanding AR Balance
                </span>
                <FileText className={`h-4 w-4 ${Number(overview?.overdueBalance || 0) > 0 ? 'text-rose-400' : 'text-amber-400'}`} />
              </div>
              <div className={`text-2xl font-bold font-mono mt-2 ${Number(overview?.overdueBalance || 0) > 0 ? 'text-rose-300' : 'text-amber-300'}`}>
                ₹{Number(overview?.outstandingArBalance || 0).toFixed(2)}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {overview?.overdueInvoicesCount || 0} overdue invoices (₹{Number(overview?.overdueBalance || 0).toFixed(2)})
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription Health & Churn Metrics */}
      {overview && (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500 block">Active Subscriptions</span>
              <strong className="text-emerald-400 text-sm font-mono">{overview.activeSubscriptionsCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Paused Agreements</span>
              <strong className="text-amber-400 text-sm font-mono">{overview.pausedSubscriptionsCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Closed / Churned</span>
              <strong className="text-rose-400 text-sm font-mono">{overview.closedSubscriptionsCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Total Contracts</span>
              <strong className="text-white text-sm font-mono">{overview.totalSubscriptionsCount}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">Churn Rate:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-white font-mono">
              {overview.churnRate}%
            </span>
          </div>
        </div>
      )}

      {/* Accounts Receivable Aging Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wider uppercase">
              Accounts Receivable Aging Analysis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Outstanding debtor balances categorized by payment due date aging buckets.
            </p>
          </div>
          <Link
            to="/admin/invoices"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
          >
            <span>View All Invoices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isAgingLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner message="Calculating aging buckets..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {aging?.brackets.map((bracket) => {
              const isOverdueBracket = bracket.bracket !== 'CURRENT';
              return (
                <div
                  key={bracket.bracket}
                  className={`p-4 rounded-xl border ${
                    isOverdueBracket && Number(bracket.totalAmount) > 0
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {bracket.label}
                  </span>
                  <div
                    className={`text-lg font-bold font-mono mt-1 ${
                      isOverdueBracket && Number(bracket.totalAmount) > 0
                        ? 'text-rose-300'
                        : 'text-white'
                    }`}
                  >
                    ₹{Number(bracket.totalAmount).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {bracket.count} {bracket.count === 1 ? 'invoice' : 'invoices'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overdue Invoices Alert Table */}
      {aging && aging.overdueInvoices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
              High Priority: Overdue Invoices Requiring Follow-Up ({aging.overdueInvoices.length})
            </h3>
          </div>

          <div className="border border-rose-900/40 rounded-xl overflow-hidden bg-slate-900/40">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-rose-900/30">
                <tr>
                  <th className="p-2.5 text-left font-semibold">Invoice #</th>
                  <th className="p-2.5 text-left font-semibold">Customer</th>
                  <th className="p-2.5 text-left font-semibold">Due Date</th>
                  <th className="p-2.5 text-right font-semibold">Aging</th>
                  <th className="p-2.5 text-right font-semibold">Balance Due</th>
                  <th className="p-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {aging.overdueInvoices.slice(0, 5).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors text-slate-300">
                    <td className="p-2.5 font-mono text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      {inv.invoiceNumber}
                    </td>
                    <td className="p-2.5 font-medium text-white">{inv.customerName}</td>
                    <td className="p-2.5 text-slate-400">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {inv.daysOverdue} days overdue
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-rose-300">
                      ₹{Number(inv.balanceDue).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-right">
                      <Link
                        to="/admin/invoices"
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
