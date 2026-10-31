import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  Wallet,
  Building,
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react';
import { UserDto, CustomerCreditHistoryDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<UserDto | null>(null);

  // Fetch customers
  const {
    data: customersData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<{ users: UserDto[] }>({
    queryKey: ['staff-customers', searchTerm],
    queryFn: async () => {
      const url = searchTerm
        ? `/api/users?role=CUSTOMER&search=${encodeURIComponent(searchTerm)}`
        : '/api/users?role=CUSTOMER';
      const res = await apiClient.get(url);
      return { users: res.data.data };
    },
  });

  // Fetch credit ledger when modal is open
  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
  } = useQuery<CustomerCreditHistoryDto>({
    queryKey: ['customer-ledger', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null;
      const res = await apiClient.get(`/api/users/credit-history?customerId=${selectedCustomer.id}`);
      return res.data.data;
    },
    enabled: !!selectedCustomer,
  });

  const customers = customersData?.users || [];

  const totalCreditHoldings = customers.reduce(
    (acc, c) => acc + Number(c.creditBalance || 0),
    0,
  );

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            Customer Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse registered customer accounts, view contact details, and audit credit balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Total Registered Customers</span>
              <div className="text-2xl font-bold text-white font-mono mt-1">
                {customers.length}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium">Customer Credit Balance Holdings</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                ₹{totalCreditHoldings.toFixed(2)}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="p-4 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold text-white">
              Customer Accounts ({customers.length})
            </CardTitle>
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12">
              <LoadingSpinner message="Loading customer accounts..." />
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No Customers Found"
                description={
                  searchTerm
                    ? `No customer accounts matching "${searchTerm}".`
                    : 'No customer accounts registered in the system yet.'
                }
                icon={<Users className="h-6 w-6" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Credit Balance</th>
                    <th className="py-3 px-4">Joined</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {customers.map((c) => {
                    const creditNum = Number(c.creditBalance || 0);
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{c.fullName}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.companyName ? (
                            <span className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-slate-400" />
                              {c.companyName}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="success">Active</Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">
                          <span className={creditNum > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                            ₹{creditNum.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCustomer(c)}
                          >
                            <Wallet className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                            Audit Ledger
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Ledger Modal */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`Credit Ledger: ${selectedCustomer.fullName}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Available Credit Balance</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  ₹{Number(ledgerData?.creditBalance ?? selectedCustomer.creditBalance).toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Email Account</span>
                <span className="text-xs text-slate-300 font-mono">{selectedCustomer.email}</span>
              </div>
            </div>

            {isLedgerLoading ? (
              <div className="py-8">
                <LoadingSpinner message="Fetching customer credit history..." />
              </div>
            ) : !ledgerData?.transactions || ledgerData.transactions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No credit surplus or payment allocations recorded for this customer yet.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Ref</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {ledgerData.transactions.map((tx) => {
                      const isCredit = tx.type === 'CREDIT';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 px-3">
                            {isCredit ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                                <ArrowDownLeft className="h-3 w-3" />
                                + Surplus
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                                <ArrowUpRight className="h-3 w-3" />
                                - Applied
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{tx.reference}</td>
                          <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            <span className={isCredit ? 'text-emerald-400' : 'text-slate-300'}>
                              {isCredit ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
