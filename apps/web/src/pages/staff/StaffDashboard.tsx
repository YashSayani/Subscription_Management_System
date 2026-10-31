import React from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  FileText,
  CreditCard,
  Package,
  Users,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const StaffDashboard: React.FC = () => {
  const { user } = useAuth();

  const operationalNav = [
    {
      title: 'Quotations & Subscriptions',
      desc: 'Draft quotes from customer selections, apply eligible discounts, and convert to active subscriptions.',
      to: '/staff/subscriptions',
      icon: Layers,
      tag: 'Orders',
    },
    {
      title: 'Invoices & Billing',
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
    {
      title: 'Customer Accounts',
      desc: 'View customer contact records, active subscriptions, and available credit balances.',
      to: '/staff/customers',
      icon: Users,
      tag: 'Customers',
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
            Signed in as <span className="text-slate-200 font-medium">{user?.fullName}</span>. Manage customer quotes, recurring subscriptions, and manual payment allocation.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
          <Briefcase className="h-4 w-4 text-blue-400" />
          <span>Operational Monolith</span>
        </div>
      </div>

      {/* Operational Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Open Quotations</span>
              <Layers className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">0</div>
            <p className="text-[10px] text-slate-500 mt-1">Quotes awaiting confirmation</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Pending Invoices</span>
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">0</div>
            <p className="text-[10px] text-slate-500 mt-1">Confirmed invoices awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Payments Logged Today</span>
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">₹0.00</div>
            <p className="text-[10px] text-slate-500 mt-1">Total manual collections today</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Modules */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Operations & Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
