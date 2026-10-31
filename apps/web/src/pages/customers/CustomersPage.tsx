import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Wallet,
  Building,
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Plus,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  CheckCircle2,
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
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<UserDto | null>(null);

  // Create customer modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [initialCredit, setInitialCredit] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSuccess, setCreatedSuccess] = useState<{
    email: string;
    fullName: string;
    temporaryPassword?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const resetCreateForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setCompanyName('');
    setTaxId('');
    setBillingAddress('');
    setInitialCredit('');
    setShowPassword(false);
    setFormError(null);
    setCreatedSuccess(null);
    setCopied(false);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let generated = 'Bright#';
    for (let i = 0; i < 6; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    generated += '!';
    setPassword(generated);
    setShowPassword(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setFormError('Full name must be at least 2 characters long');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 9) {
      setFormError('Password must be at least 9 characters long with uppercase, lowercase, and special characters');
      return;
    }

    const creditNum = initialCredit ? parseFloat(initialCredit) : undefined;
    if (creditNum !== undefined && (isNaN(creditNum) || creditNum < 0)) {
      setFormError('Initial credit balance cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiClient.post('/api/users/customers', {
        fullName: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword || undefined,
        companyName: companyName.trim() || undefined,
        taxId: taxId.trim() || undefined,
        billingAddress: billingAddress.trim() || undefined,
        initialCredit: creditNum,
      });

      const data = res.data.data;
      queryClient.invalidateQueries({ queryKey: ['staff-customers'] });

      setCreatedSuccess({
        email: data.customer.email,
        fullName: data.customer.fullName,
        temporaryPassword: data.temporaryPassword || (trimmedPassword || undefined),
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err as Error).message ||
        'Failed to create customer';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdSuccess) return;
    const text = `Brightloop Customer Portal Access\nEmail: ${createdSuccess.email}\nPassword: ${createdSuccess.temporaryPassword || '(Provided during setup)'}\nURL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Customer
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
                    : 'No customer accounts registered in the system yet. Click "Add Customer" to create the first one.'
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

      {/* Add New Customer Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            if (!isSubmitting) {
              setIsCreateModalOpen(false);
              resetCreateForm();
            }
          }}
          title={createdSuccess ? 'Customer Created Successfully' : 'Register New Customer Account'}
          maxWidth="lg"
        >
          {createdSuccess ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white">Customer Account Ready</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Customer <strong className="text-emerald-300">{createdSuccess.fullName}</strong> was registered. You can provide these credentials for login.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Login Portal URL:</span>
                  <span className="font-mono text-slate-200">{window.location.origin}/login</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Email Address:</span>
                  <span className="font-mono text-emerald-400 font-medium">{createdSuccess.email}</span>
                </div>
                {createdSuccess.temporaryPassword && (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Generated Password:</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      {createdSuccess.temporaryPassword}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCredentials}
                  className="flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-400" />
                      <span>Copy Credentials</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Personal & Account Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    placeholder="E.g., Priya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="priya@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password Field with Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password <span className="text-slate-500 text-[10px]">(Optional — auto-generated if left blank)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto-Generate Secure Password
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 9 chars, uppercase, lowercase, special (!@#)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Key className="h-4 w-4 text-slate-400" />}
                  />
                  {password && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Business Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Company Name
                  </label>
                  <Input
                    placeholder="E.g., Acme Cloud Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    leftIcon={<Building className="h-4 w-4 text-slate-400" />}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tax ID / GSTIN
                  </label>
                  <Input
                    placeholder="27ABCDE1234F1Z5"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>
              </div>

              {/* Initial Credit Balance */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Opening Credit Balance (₹) <span className="text-slate-500 text-[10px]">(Optional prepaid balance)</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={initialCredit}
                  onChange={(e) => setInitialCredit(e.target.value)}
                  leftIcon={<Wallet className="h-4 w-4 text-slate-400" />}
                />
              </div>

              {/* Billing Address */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Billing Address
                </label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none h-16"
                  placeholder="Street Address, City, State, ZIP..."
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Creating Account...
                    </span>
                  ) : (
                    'Create Customer Account'
                  )}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

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
