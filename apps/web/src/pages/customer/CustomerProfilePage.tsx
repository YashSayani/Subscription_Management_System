import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  User,
  Building,
  FileText,
  Wallet,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Mail,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { CustomerCreditHistoryDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomerProfilePage: React.FC = () => {
  const { user, refetchUser } = useAuth();

  // Profile form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [taxId, setTaxId] = useState(user?.taxId || '');
  const [billingAddress, setBillingAddress] = useState(user?.billingAddress || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setCompanyName(user.companyName || '');
      setTaxId(user.taxId || '');
      setBillingAddress(user.billingAddress || '');
    }
  }, [user]);

  // Credit history query
  const {
    data: creditData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isFetching: isFetchingHistory,
  } = useQuery<CustomerCreditHistoryDto>({
    queryKey: ['customer-credit-history'],
    queryFn: async () => {
      const res = await apiClient.get('/api/users/credit-history');
      return res.data.data;
    },
  });

  const transactions = creditData?.transactions || [];
  const currentCredit = creditData?.creditBalance ?? user?.creditBalance ?? '0.00';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      if (!fullName.trim() || fullName.trim().length < 2) {
        throw new Error('Full name must be at least 2 characters long');
      }

      await apiClient.patch('/api/users/profile', {
        fullName: fullName.trim(),
        companyName: companyName.trim() || null,
        taxId: taxId.trim() || null,
        billingAddress: billingAddress.trim() || null,
      });

      await refetchUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setSaveError(
        errorObj.response?.data?.error?.message || errorObj.message || 'Failed to update profile',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">My Account & Credit Ledger</h1>
            <Badge variant="success">Customer Portal</Badge>
          </div>
          <p className="text-xs text-slate-400">
            Manage your billing profile, tax credentials, and view your automated credit surplus ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/portal/invoices">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" />
              View Invoices
            </Button>
          </Link>
        </div>
      </div>

      {/* Credit Balance Highlight Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 border-emerald-500/40 md:col-span-1 shadow-lg">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <Wallet className="h-4 w-4" /> Available Credit Balance
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Active Credit
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-emerald-400 tracking-tight my-2">
                ₹{Number(currentCredit).toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mt-2">
                Overpayments and account adjustments are credited directly to your balance and can be applied to offset upcoming or open invoices.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Auto-settlement eligible
              </span>
              <Link
                to="/portal/invoices"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
              >
                <span>Apply on Invoices</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account Info Quick Glance */}
        <Card className="bg-slate-900/40 border-slate-800 md:col-span-2">
          <CardHeader className="pb-3 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Account Verification & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Registered Email</span>
              <div className="flex items-center gap-2 text-sm text-white font-medium">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </div>
              <span className="inline-block mt-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Primary Account ID
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Customer Identifier</span>
              <div className="text-xs font-mono text-slate-300 truncate" title={user?.id}>
                {user?.id}
              </div>
              <span className="inline-block mt-2 text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                Strict IDOR Protected
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Member Since</span>
              <div className="text-sm text-slate-200 font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }) : 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-1">Tax / GSTIN Status</span>
              <div className="text-sm font-medium text-slate-200">
                {user?.taxId ? (
                  <span className="text-emerald-400 font-mono">{user.taxId}</span>
                ) : (
                  <span className="text-slate-500 italic">No GSTIN registered</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Form & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Edit Billing Profile (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader className="border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-400" />
                Billing Profile Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {saveSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Profile information updated successfully!</span>
                  </div>
                )}

                {saveError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                <Input
                  label="Full Name *"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alice Walker"
                  required
                  leftIcon={<User className="h-4 w-4" />}
                />

                <Input
                  label="Company / Legal Entity Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Walker Enterprises Ltd"
                  leftIcon={<Building className="h-4 w-4" />}
                  helperText="Printed on official tax invoice receipts"
                />

                <Input
                  label="Tax ID / GSTIN"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. 27AABCU9603R1ZM"
                  leftIcon={<FileText className="h-4 w-4" />}
                  helperText="Required for input tax credit claims"
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Billing Address
                  </label>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="e.g. 42 Marina Boulevard, Suite 10, Mumbai, MH 400001"
                      className="block w-full rounded-lg bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm py-2 px-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Full billing address for invoice generation and export
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSaving}
                    className="w-full justify-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Credit Transaction Ledger (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-slate-900/40 border-slate-800">
            <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                Credit Balance Ledger & Statements
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchHistory()}
                disabled={isFetchingHistory}
                className="text-slate-400 hover:text-white"
                title="Refresh Credit Ledger"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="py-12">
                  <LoadingSpinner message="Loading credit transaction history..." />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title="No Credit Transactions Yet"
                    description="When you make an overpayment or receive an account balance adjustment, the credits and their subsequent invoice applications will be tracked here."
                    icon={<Wallet className="h-6 w-6" />}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {transactions.map((tx) => {
                        const isCredit = tx.type === 'CREDIT';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-4">
                              {isCredit ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <ArrowDownLeft className="h-3 w-3" />
                                  + Surplus Credit
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <ArrowUpRight className="h-3 w-3" />
                                  - Applied
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-200">
                              {tx.reference}
                            </td>
                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
