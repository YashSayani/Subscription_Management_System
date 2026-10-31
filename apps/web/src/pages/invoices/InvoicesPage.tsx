import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Printer,
  Ban,
  AlertTriangle,
  Play,
  Calendar,
  Building,
  Mail,
  Receipt,
  Eye,
  RefreshCw,
  Tag,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { InvoiceDto, InvoiceStatus, UserRole } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [inspectInvoice, setInspectInvoice] = useState<InvoiceDto | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<InvoiceDto | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Coupon state for modal
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    if (!inspectInvoice || !couponCode.trim()) return;
    setCouponError(null);
    setCouponSuccess(null);
    setIsApplyingCoupon(true);

    try {
      const res = await apiClient.post(`/api/invoices/${inspectInvoice.id}/apply-discount`, {
        code: couponCode.trim().toUpperCase(),
      });
      const updatedInvoice = res.data.data.invoice;
      setInspectInvoice(updatedInvoice);
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      setCouponSuccess(`Coupon '${couponCode.trim().toUpperCase()}' applied successfully! Balance updated.`);
      setCouponCode('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err as Error).message ||
        'Failed to apply coupon';
      setCouponError(msg);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // 1. Fetch Invoices
  const {
    data: invoicesData,
    isLoading,
    error: fetchError,
    refetch,
    isFetching,
  } = useQuery<{ invoices: InvoiceDto[] }>({
    queryKey: ['invoices-list', selectedStatusTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatusTab === 'OVERDUE') {
        params.append('overdueOnly', 'true');
      } else if (selectedStatusTab !== 'ALL') {
        params.append('status', selectedStatusTab);
      }
      const res = await apiClient.get(`/api/invoices?${params.toString()}`);
      return res.data.data;
    },
  });

  // 2. Run Billing Cycle Mutation
  const runBillingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/billing/run-worker');
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      alert(`Billing cycle executed! Generated ${data.invoicesGenerated} invoices across ${data.subscriptionsProcessed} subscriptions.`);
    },
    onError: (err: unknown) => {
      const errMsg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to run billing cycle.';
      setActionError(errMsg);
    },
  });

  // 3. Cancel Invoice Mutation
  const cancelInvoiceMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/api/invoices/${id}/cancel`, { reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      setCancelModalInvoice(null);
      setInspectInvoice(null);
      setCancelReason('');
    },
    onError: (err: unknown) => {
      const errMsg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to cancel invoice.';
      setActionError(errMsg);
    },
  });

  const invoices = invoicesData?.invoices || [];

  // Filter client-side by search query
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const invNum = inv.invoiceNumber.toLowerCase();
    const custName = inv.customer?.fullName.toLowerCase() || '';
    const custEmail = inv.customer?.email.toLowerCase() || '';
    const compName = inv.customer?.companyName?.toLowerCase() || '';
    const subNum = inv.subscription?.subscriptionNumber.toLowerCase() || '';
    return (
      invNum.includes(q) ||
      custName.includes(q) ||
      custEmail.includes(q) ||
      compName.includes(q) ||
      subNum.includes(q)
    );
  });

  // KPI calculations
  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + Number(inv.paidAmount || 0), 0);
  const totalBalanceDue = invoices.reduce((acc, inv) => acc + Number(inv.balanceDue || 0), 0);
  const overdueCount = invoices.filter((inv) => inv.isOverdue).length;
  const overdueAmount = invoices
    .filter((inv) => inv.isOverdue)
    .reduce((acc, inv) => acc + Number(inv.balanceDue || 0), 0);

  const getStatusBadge = (inv: InvoiceDto) => {
    if (inv.isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          OVERDUE
        </span>
      );
    }
    switch (inv.status) {
      case InvoiceStatus.PAID:
        return <Badge variant="success">PAID</Badge>;
      case InvoiceStatus.PARTIALLY_PAID:
        return <Badge variant="info">PARTIALLY PAID</Badge>;
      case InvoiceStatus.CONFIRMED:
        return <Badge variant="warning">CONFIRMED</Badge>;
      case InvoiceStatus.CANCELLED:
        return <Badge variant="neutral">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{inv.status}</Badge>;
    }
  };

  const handlePrint = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/print`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-indigo-400" />
            Invoices & Recurring Statements
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track automated billing cycles, derived overdue aging, tax snapshots, and printable receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {user?.role === UserRole.ADMIN && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => runBillingMutation.mutate()}
              isLoading={runBillingMutation.isPending}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Billing Cycle
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-xs underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-slate-400">Total Billed</span>
            <div className="text-xl font-bold text-white mt-1">₹{totalBilled.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">{invoices.length} invoices generated</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-emerald-400">Total Collected</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">₹{totalCollected.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Recorded & settled payments</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-400">Outstanding Balance</span>
            <div className="text-xl font-bold text-amber-300 mt-1">₹{totalBalanceDue.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Remaining balance due</span>
          </CardContent>
        </Card>

        <Card className={`border ${overdueCount > 0 ? 'bg-rose-950/20 border-rose-800/50' : 'bg-slate-900/60 border-slate-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-400">Overdue Balance</span>
              {overdueCount > 0 && <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />}
            </div>
            <div className="text-xl font-bold text-rose-300 mt-1">₹{overdueAmount.toFixed(2)}</div>
            <span className="text-[11px] text-rose-400/80 mt-0.5 block">{overdueCount} invoices past due date</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'ALL', label: 'All Invoices' },
            { id: 'CONFIRMED', label: 'Confirmed' },
            { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
            { id: 'PAID', label: 'Paid' },
            { id: 'OVERDUE', label: 'Overdue' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                selectedStatusTab === tab.id
                  ? tab.id === 'OVERDUE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search invoice #, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Loading invoices & billing ledger..." />
        </div>
      ) : fetchError ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">Failed to fetch invoices</p>
          <p className="text-xs text-slate-500 mt-1">Please check your network connection or server logs.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No invoices found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No invoices match your current search filters.'
                : 'Invoices will be automatically generated when confirmed subscriptions reach their billing cycle.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-800 bg-slate-950/60">
                <TableHead className="text-slate-400 font-semibold">Invoice #</TableHead>
                <TableHead className="text-slate-400 font-semibold">Customer</TableHead>
                <TableHead className="text-slate-400 font-semibold">Subscription</TableHead>
                <TableHead className="text-slate-400 font-semibold">Due Date</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Total</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Paid</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Balance Due</TableHead>
                <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                >
                  <TableCell className="font-mono font-medium text-white">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>{inv.invoiceNumber}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm font-medium text-white">{inv.customer?.fullName}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {inv.customer?.companyName ? (
                        <>
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>{inv.customer.companyName}</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{inv.customer?.email}</span>
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-mono text-xs text-slate-300">
                      {inv.subscription?.subscriptionNumber || 'N/A'}
                    </div>
                    {inv.subscription?.plan && (
                      <span className="text-[11px] text-slate-500">
                        {inv.subscription.plan.name} ({inv.subscription.plan.billingFrequency})
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span className={inv.isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Period: {new Date(inv.periodStartDate).toLocaleDateString()} - {new Date(inv.periodEndDate).toLocaleDateString()}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-mono font-medium text-white">
                    ₹{Number(inv.totalAmount).toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-emerald-400">
                    ₹{Number(inv.paidAmount).toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right font-mono font-semibold">
                    <span className={inv.isOverdue ? 'text-rose-400' : Number(inv.balanceDue) > 0 ? 'text-amber-300' : 'text-slate-400'}>
                      ₹{Number(inv.balanceDue).toFixed(2)}
                    </span>
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(inv)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectInvoice(inv)}
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrint(inv.id)}
                        title="Print / Export PDF"
                        className="text-slate-400 hover:text-white"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>

                      {user?.role === UserRole.ADMIN &&
                        inv.status !== InvoiceStatus.CANCELLED &&
                        inv.status !== InvoiceStatus.PAID &&
                        Number(inv.paidAmount) === 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCancelModalInvoice(inv);
                              setCancelReason('');
                            }}
                            title="Cancel / Void Invoice"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invoice Details Modal */}
      {inspectInvoice && (
        <Modal
          isOpen={!!inspectInvoice}
          onClose={() => setInspectInvoice(null)}
          title={`Invoice ${inspectInvoice.invoiceNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-6">
            {/* Status & Alerts Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Current Status:</span>
                {getStatusBadge(inspectInvoice)}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Due Date:</span>
                <span className={`font-mono font-medium ${inspectInvoice.isOverdue ? 'text-rose-400 font-bold' : 'text-white'}`}>
                  {new Date(inspectInvoice.dueDate).toLocaleDateString()}
                </span>
                {inspectInvoice.isOverdue && (
                  <span className="text-rose-400 font-semibold">(PAST DUE)</span>
                )}
              </div>
            </div>

            {/* Customer & Billing Meta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Customer Details</span>
                <p className="text-sm font-semibold text-white">{inspectInvoice.customer?.fullName}</p>
                {inspectInvoice.customer?.companyName && (
                  <p className="text-slate-300">{inspectInvoice.customer.companyName}</p>
                )}
                <p className="text-slate-400">{inspectInvoice.customer?.email}</p>
                {inspectInvoice.customer?.taxId && (
                  <p className="text-slate-400 font-mono">Tax / GST: {inspectInvoice.customer.taxId}</p>
                )}
                {inspectInvoice.customer?.billingAddress && (
                  <p className="text-slate-400">{inspectInvoice.customer.billingAddress}</p>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Subscription & Period</span>
                <p className="text-slate-300">
                  <span className="text-slate-500">Subscription Ref:</span>{' '}
                  <span className="font-mono text-indigo-400">{inspectInvoice.subscription?.subscriptionNumber || 'N/A'}</span>
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Plan:</span> {inspectInvoice.subscription?.plan?.name || 'N/A'} (
                  {inspectInvoice.subscription?.plan?.billingFrequency})
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Billing Period:</span>{' '}
                  {new Date(inspectInvoice.periodStartDate).toLocaleDateString()} &mdash;{' '}
                  {new Date(inspectInvoice.periodEndDate).toLocaleDateString()}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Invoice Issued:</span>{' '}
                  {new Date(inspectInvoice.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Invoice Line Items</h4>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 text-left">Description</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Tax</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {inspectInvoice.lines?.map((line) => (
                      <tr key={line.id} className="text-slate-300">
                        <td className="p-2.5">
                          <div className="font-medium text-white">{line.description}</div>
                          {Number(line.variantAdjustment) > 0 && (
                            <div className="text-[10px] text-slate-500">
                              Includes variant adjustment (+₹{Number(line.variantAdjustment).toFixed(2)})
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono">{line.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{Number(line.unitPrice).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono">
                          ₹{Number(line.taxAmount).toFixed(2)} ({Number(line.taxRate)}%)
                        </td>
                        <td className="p-2.5 text-right font-mono font-medium text-white">
                          ₹{Number(line.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Promotional Coupon Application Section */}
            {inspectInvoice.discountId || Number(inspectInvoice.discountAmount) > 0 ? (
              <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Tag className="w-4 h-4 shrink-0" />
                  <span>
                    Promotional Coupon Applied:{' '}
                    <strong className="font-mono text-emerald-300">
                      {inspectInvoice.discount?.code || 'ACTIVE_PROMO'}
                    </strong>
                  </span>
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  -₹{Number(inspectInvoice.discountAmount).toFixed(2)}
                </span>
              </div>
            ) : (inspectInvoice.status === InvoiceStatus.CONFIRMED || inspectInvoice.status === InvoiceStatus.PARTIALLY_PAID) ? (
              <div className="p-4 rounded-xl bg-slate-900/70 border border-indigo-500/20 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    Apply Promo / Discount Coupon
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">e.g. SAVE20 or FLAT500</span>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter coupon code (e.g. SAVE20)"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError(null);
                      setCouponSuccess(null);
                    }}
                    className="font-mono uppercase text-xs"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isApplyingCoupon || !couponCode.trim()}
                    onClick={handleApplyCoupon}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    {isApplyingCoupon ? 'Applying...' : 'Apply Coupon'}
                  </Button>
                </div>

                {couponError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {couponError}
                  </p>
                )}

                {couponSuccess && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {couponSuccess}
                  </p>
                )}
              </div>
            ) : null}

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-1.5 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-white">₹{Number(inspectInvoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(inspectInvoice.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span className="font-mono">-₹{Number(inspectInvoice.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Tax Amount</span>
                  <span className="font-mono text-white">₹{Number(inspectInvoice.taxAmount).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-white text-sm">
                  <span>Total Amount</span>
                  <span className="font-mono">₹{Number(inspectInvoice.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Paid Amount</span>
                  <span className="font-mono">₹{Number(inspectInvoice.paidAmount).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-sm">
                  <span className={inspectInvoice.isOverdue ? 'text-rose-400' : 'text-amber-300'}>Balance Due</span>
                  <span className={`font-mono ${inspectInvoice.isOverdue ? 'text-rose-400' : 'text-amber-300'}`}>
                    ₹{Number(inspectInvoice.balanceDue).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Allocations History */}
            {inspectInvoice.allocations && inspectInvoice.allocations.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Payment Allocations</h4>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2 text-left">Payment #</th>
                        <th className="p-2 text-left">Method</th>
                        <th className="p-2 text-left">Date</th>
                        <th className="p-2 text-right">Allocated Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {inspectInvoice.allocations.map((alloc) => (
                        <tr key={alloc.id} className="text-slate-300">
                          <td className="p-2 font-mono text-white">{alloc.payment?.paymentNumber || 'N/A'}</td>
                          <td className="p-2">{alloc.payment?.method || 'N/A'}</td>
                          <td className="p-2">{alloc.payment ? new Date(alloc.payment.paymentDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="p-2 text-right font-mono text-emerald-400">₹{Number(alloc.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrint(inspectInvoice.id)}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print Tax Invoice (PDF)
              </Button>

              <div className="flex items-center gap-2">
                {user?.role === UserRole.ADMIN &&
                  inspectInvoice.status !== InvoiceStatus.CANCELLED &&
                  inspectInvoice.status !== InvoiceStatus.PAID &&
                  Number(inspectInvoice.paidAmount) === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCancelModalInvoice(inspectInvoice);
                        setCancelReason('');
                      }}
                      className="text-rose-400 border-rose-800 hover:bg-rose-950/30 flex items-center gap-1.5"
                    >
                      <Ban className="w-4 h-4" />
                      Void / Cancel Invoice
                    </Button>
                  )}

                <Button variant="secondary" size="sm" onClick={() => setInspectInvoice(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalInvoice && (
        <Modal
          isOpen={!!cancelModalInvoice}
          onClose={() => setCancelModalInvoice(null)}
          title={`Void Invoice ${cancelModalInvoice.invoiceNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-300">
                <p className="font-semibold text-rose-200">Warning: Irreversible Action</p>
                <p className="mt-1">
                  Voiding this invoice will transition its status to CANCELLED and permanently stop any payments from being applied.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Cancellation Reason (Required)
              </label>
              <textarea
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                rows={3}
                placeholder="E.g., Customer billing dispute resolved, duplicate billing cycle, customer requested plan downgrade..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalInvoice(null)}
                disabled={cancelInvoiceMutation.isPending}
              >
                Keep Invoice
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (!cancelReason.trim()) {
                    setActionError('Cancellation reason is required.');
                    return;
                  }
                  cancelInvoiceMutation.mutate({
                    id: cancelModalInvoice.id,
                    reason: cancelReason.trim(),
                  });
                }}
                isLoading={cancelInvoiceMutation.isPending}
                disabled={!cancelReason.trim()}
              >
                Confirm Void
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
