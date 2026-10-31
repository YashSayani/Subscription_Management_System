import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Search,
  Plus,
  RefreshCw,
  Building,
  Mail,
  Calendar,
  AlertTriangle,
  FileText,
  Eye,
  Wallet,
} from 'lucide-react';
import {
  PaymentDto,
  PaymentMethod,
  InvoiceDto,
  InvoiceStatus,
  UserDto,
} from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [inspectPayment, setInspectPayment] = useState<PaymentDto | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State for Recording Payment
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.MANUAL_BANK_TRANSFER,
  );
  const [paymentNotes, setPaymentNotes] = useState('');
  const [allocationsMap, setAllocationsMap] = useState<Record<string, string>>({});

  // 1. Fetch Payments List
  const {
    data: paymentsData,
    isLoading: isPaymentsLoading,
    error: paymentsError,
    refetch,
    isFetching,
  } = useQuery<{ payments: PaymentDto[] }>({
    queryKey: ['payments-list', selectedMethod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMethod !== 'ALL') {
        params.append('method', selectedMethod);
      }
      const res = await apiClient.get(`/api/payments?${params.toString()}`);
      return { payments: res.data.data };
    },
  });

  // 2. Fetch Customers for modal
  const { data: usersData } = useQuery<{ users: UserDto[] }>({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await apiClient.get('/api/users?role=CUSTOMER');
      return { users: res.data.data };
    },
    enabled: isRecordModalOpen,
  });

  // 3. Fetch Customer's open invoices when customer is selected
  const { data: customerInvoicesData, isLoading: isInvoicesLoading } = useQuery<{
    invoices: InvoiceDto[];
  }>({
    queryKey: ['customer-open-invoices', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return { invoices: [] };
      const res = await apiClient.get(`/api/invoices?customerId=${selectedCustomerId}`);
      const allInvoices: InvoiceDto[] = res.data.data.invoices || [];
      const openInvoices = allInvoices.filter(
        (inv) =>
          inv.status === InvoiceStatus.CONFIRMED ||
          inv.status === InvoiceStatus.PARTIALLY_PAID,
      );
      return { invoices: openInvoices };
    },
    enabled: !!selectedCustomerId && isRecordModalOpen,
  });

  // 4. Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId) {
        throw new Error('Please select a customer.');
      }
      const amountNum = parseFloat(paymentAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid payment amount greater than zero.');
      }

      // Build allocations array from allocationsMap
      const allocations = Object.entries(allocationsMap)
        .filter(([, amtStr]) => {
          const amt = parseFloat(amtStr);
          return !isNaN(amt) && amt > 0;
        })
        .map(([invoiceId, amtStr]) => ({
          invoiceId,
          amount: parseFloat(amtStr),
        }));

      const res = await apiClient.post('/api/payments', {
        customerId: selectedCustomerId,
        amount: amountNum,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        method: paymentMethod,
        notes: paymentNotes.trim() || undefined,
        allocations: allocations.length > 0 ? allocations : undefined,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      setIsRecordModalOpen(false);
      resetForm();
      alert(`Payment ${data.paymentNumber} recorded successfully!`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ||
        (err as Error).message ||
        'Failed to record payment.';
      setActionError(msg);
    },
  });

  const resetForm = () => {
    setSelectedCustomerId('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod(PaymentMethod.MANUAL_BANK_TRANSFER);
    setPaymentNotes('');
    setAllocationsMap({});
    setActionError(null);
  };

  const payments = paymentsData?.payments || [];

  // Client search filter
  const filteredPayments = payments.filter((pay) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pNum = pay.paymentNumber.toLowerCase();
    const custName = pay.customer?.fullName.toLowerCase() || '';
    const custEmail = pay.customer?.email.toLowerCase() || '';
    const compName = pay.customer?.companyName?.toLowerCase() || '';
    const notes = pay.notes?.toLowerCase() || '';
    return (
      pNum.includes(q) ||
      custName.includes(q) ||
      custEmail.includes(q) ||
      compName.includes(q) ||
      notes.includes(q)
    );
  });

  // KPIs
  const totalAmountRecorded = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalAmountAllocated = payments.reduce(
    (sum, p) => sum + Number(p.totalAllocated || 0),
    0,
  );
  const totalSurplusCredited = payments.reduce(
    (sum, p) => sum + Number(p.surplusAmount || 0),
    0,
  );

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.MANUAL_BANK_TRANSFER:
        return <Badge variant="info">BANK TRANSFER</Badge>;
      case PaymentMethod.CHEQUE:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
            CHEQUE
          </span>
        );
      case PaymentMethod.CASH:
        return <Badge variant="success">CASH</Badge>;
      case PaymentMethod.OTHER:
      default:
        return <Badge variant="neutral">{method}</Badge>;
    }
  };

  // Live modal allocation calculations
  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const currentTotalAllocated = Object.values(allocationsMap).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
  const currentSurplus = Math.max(0, parsedPaymentAmount - currentTotalAllocated);
  const isOverAllocated = currentTotalAllocated > parsedPaymentAmount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-400" />
            Manual Payments & Credit Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Record manual offline receipts, execute multi-invoice allocations, and maintain customer credit surplus balances.
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

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setIsRecordModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-xs underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-slate-400">Total Payments Recorded</span>
            <div className="text-xl font-bold text-white mt-1">₹{totalAmountRecorded.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">{payments.length} transactions logged</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-emerald-400">Directly Allocated</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">₹{totalAmountAllocated.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Applied to open invoices</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-indigo-400">Credit Surplus Balance</span>
            <div className="text-xl font-bold text-indigo-300 mt-1">₹{totalSurplusCredited.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Stored on customer credit ledger</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-400">Settlement Ratio</span>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {totalAmountRecorded > 0
                ? `${((totalAmountAllocated / totalAmountRecorded) * 100).toFixed(1)}%`
                : '0.0%'}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Allocated vs total payments</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center overflow-x-auto gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          {[
            { id: 'ALL', label: 'All Methods' },
            { id: PaymentMethod.MANUAL_BANK_TRANSFER, label: 'Bank Transfer' },
            { id: PaymentMethod.CHEQUE, label: 'Cheque' },
            { id: PaymentMethod.CASH, label: 'Cash' },
            { id: PaymentMethod.OTHER, label: 'Other' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedMethod(tab.id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                selectedMethod === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search payment #, customer, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>
      </div>

      {/* Payments Table */}
      {isPaymentsLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Loading payments ledger..." />
        </div>
      ) : paymentsError ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">Failed to fetch payments</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-12 text-center">
            <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No payments found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No payments match your search criteria.'
                : 'Click "Record Payment" to log offline cheques, bank transfers, or cash receipts.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-800 bg-slate-950/60">
                <TableHead className="text-slate-400 font-semibold">Payment #</TableHead>
                <TableHead className="text-slate-400 font-semibold">Customer</TableHead>
                <TableHead className="text-slate-400 font-semibold">Date</TableHead>
                <TableHead className="text-slate-400 font-semibold">Method</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Amount</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Allocated</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Surplus Credit</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((pay) => (
                <TableRow
                  key={pay.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                >
                  <TableCell className="font-mono font-medium text-white">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>{pay.paymentNumber}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm font-medium text-white">{pay.customer?.fullName}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {pay.customer?.companyName ? (
                        <>
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>{pay.customer.companyName}</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{pay.customer?.email}</span>
                        </>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-300">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(pay.paymentDate).toLocaleDateString()}</span>
                    </div>
                  </TableCell>

                  <TableCell>{getMethodBadge(pay.method)}</TableCell>

                  <TableCell className="text-right font-mono font-bold text-white">
                    ₹{Number(pay.amount).toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-emerald-400">
                    ₹{Number(pay.totalAllocated).toFixed(2)}
                  </TableCell>

                  <TableCell className="text-right font-mono">
                    {Number(pay.surplusAmount) > 0 ? (
                      <span className="text-indigo-400 font-semibold">
                        +₹{Number(pay.surplusAmount).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-slate-500">₹0.00</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectPayment(pay)}
                      title="View Details & Allocations"
                      className="text-slate-300 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Payment Details Modal */}
      {inspectPayment && (
        <Modal
          isOpen={!!inspectPayment}
          onClose={() => setInspectPayment(null)}
          title={`Payment Receipt ${inspectPayment.paymentNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Method:</span>
                {getMethodBadge(inspectPayment.method)}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Payment Date:</span>
                <span className="text-white font-mono">
                  {new Date(inspectPayment.paymentDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Customer & Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Customer
                </span>
                <p className="text-sm font-semibold text-white">{inspectPayment.customer?.fullName}</p>
                {inspectPayment.customer?.companyName && (
                  <p className="text-slate-300">{inspectPayment.customer.companyName}</p>
                )}
                <p className="text-slate-400">{inspectPayment.customer?.email}</p>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-indigo-300">
                  <span>Current Available Credit:</span>
                  <span className="font-mono font-bold">
                    ₹{Number(inspectPayment.customer?.creditBalance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Payment Summary
                </span>
                <div className="flex justify-between text-slate-300">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono font-bold text-white">
                    ₹{Number(inspectPayment.amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Allocated to Invoices:</span>
                  <span className="font-mono">
                    ₹{Number(inspectPayment.totalAllocated).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-indigo-400">
                  <span>Credited to Surplus:</span>
                  <span className="font-mono">
                    +₹{Number(inspectPayment.surplusAmount).toFixed(2)}
                  </span>
                </div>
                {inspectPayment.recordedBy && (
                  <p className="text-slate-500 text-[10px] pt-1">
                    Recorded by: {inspectPayment.recordedBy.fullName}
                  </p>
                )}
                {inspectPayment.notes && (
                  <p className="text-slate-400 text-[11px] italic pt-1">
                    Notes: &ldquo;{inspectPayment.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Allocations Table */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Settled Invoices ({inspectPayment.allocations?.length || 0})
              </h4>
              {!inspectPayment.allocations || inspectPayment.allocations.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                  No invoices were directly linked to this payment. The full payment amount was credited to the customer&apos;s surplus account.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 text-left">Invoice #</th>
                        <th className="p-2.5 text-left">Due Date</th>
                        <th className="p-2.5 text-right">Invoice Total</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5 text-right">Allocated Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {inspectPayment.allocations.map((alloc) => (
                        <tr key={alloc.id} className="text-slate-300">
                          <td className="p-2.5 font-mono text-white">
                            {alloc.invoice?.invoiceNumber || alloc.invoiceId}
                          </td>
                          <td className="p-2.5 text-slate-400">
                            {alloc.invoice?.dueDate
                              ? new Date(alloc.invoice.dueDate).toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            ₹{Number(alloc.invoice?.totalAmount || 0).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge variant={alloc.invoice?.status === InvoiceStatus.PAID ? 'success' : 'warning'}>
                              {alloc.invoice?.status || 'UPDATED'}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                            ₹{Number(alloc.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setInspectPayment(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          title="Record Manual Offline Payment"
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Customer Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Select Customer (Required)
              </label>
              <select
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setAllocationsMap({});
                }}
              >
                <option value="">-- Choose Customer --</option>
                {usersData?.users.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.email}) {c.companyName ? `- ${c.companyName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Date
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value={PaymentMethod.MANUAL_BANK_TRANSFER}>Bank Transfer</option>
                  <option value={PaymentMethod.CHEQUE}>Cheque</option>
                  <option value={PaymentMethod.CASH}>Cash</option>
                  <option value={PaymentMethod.OTHER}>Other Offline</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Transaction Reference / Cheque # / Notes
              </label>
              <Input
                placeholder="E.g., Cheque #104921, HDFC Wire REF-90218, Cash voucher"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            {/* Open Invoices Allocation Section */}
            {selectedCustomerId && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Allocate to Open Invoices
                  </span>
                  <span className="text-xs text-slate-500">
                    Remaining Surplus: <strong className={isOverAllocated ? 'text-rose-400' : 'text-indigo-400'}>₹{currentSurplus.toFixed(2)}</strong>
                  </span>
                </div>

                {isInvoicesLoading ? (
                  <div className="py-4 text-center">
                    <LoadingSpinner message="Checking customer invoices..." />
                  </div>
                ) : !customerInvoicesData?.invoices || customerInvoicesData.invoices.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-indigo-950/20 border border-indigo-800/40 text-xs text-indigo-300">
                    This customer has no open or partially paid invoices. The full amount of{' '}
                    <strong>₹{parsedPaymentAmount.toFixed(2)}</strong> will be credited directly to the customer&apos;s surplus credit balance.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2 text-left">Invoice #</th>
                          <th className="p-2 text-left">Due Date</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Balance Due</th>
                          <th className="p-2 text-right">Allocate (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {customerInvoicesData.invoices.map((inv) => {
                          const balanceDue = Number(inv.balanceDue || 0);
                          const currentAlloc = allocationsMap[inv.id] || '';

                          return (
                            <tr key={inv.id} className="text-slate-300">
                              <td className="p-2 font-mono text-white flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                {inv.invoiceNumber}
                              </td>
                              <td className="p-2 text-slate-400">
                                {new Date(inv.dueDate).toLocaleDateString()}
                              </td>
                              <td className="p-2 text-right font-mono">
                                ₹{Number(inv.totalAmount).toFixed(2)}
                              </td>
                              <td className="p-2 text-right font-mono font-semibold text-amber-300">
                                ₹{balanceDue.toFixed(2)}
                              </td>
                              <td className="p-2 text-right w-36">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <input
                                    type="number"
                                    step="0.01"
                                    max={balanceDue}
                                    placeholder="0.00"
                                    value={currentAlloc}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setAllocationsMap((prev) => ({
                                        ...prev,
                                        [inv.id]: val,
                                      }));
                                    }}
                                    className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Quick fill max possible
                                      const available = Math.min(
                                        balanceDue,
                                        Math.max(0, parsedPaymentAmount - (currentTotalAllocated - (parseFloat(currentAlloc) || 0))),
                                      );
                                      setAllocationsMap((prev) => ({
                                        ...prev,
                                        [inv.id]: available.toFixed(2),
                                      }));
                                    }}
                                    className="text-[10px] text-slate-400 hover:text-emerald-400 underline"
                                  >
                                    Max
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Allocation Summary Bar */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400">Total Allocated:</span>{' '}
                    <strong className={isOverAllocated ? 'text-rose-400' : 'text-emerald-400 font-mono'}>
                      ₹{currentTotalAllocated.toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Credited to Surplus:</span>{' '}
                    <strong className="text-indigo-400 font-mono">
                      +₹{currentSurplus.toFixed(2)}
                    </strong>
                  </div>
                </div>

                {isOverAllocated && (
                  <p className="text-xs text-rose-400">
                    Error: Total allocated amount (₹{currentTotalAllocated.toFixed(2)}) exceeds payment amount (₹{parsedPaymentAmount.toFixed(2)}).
                  </p>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRecordModalOpen(false)}
                disabled={recordPaymentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => recordPaymentMutation.mutate()}
                isLoading={recordPaymentMutation.isPending}
                disabled={!selectedCustomerId || parsedPaymentAmount <= 0 || isOverAllocated}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                Confirm & Record Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
