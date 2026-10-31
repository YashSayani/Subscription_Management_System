import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Printer,
  Calendar,
  AlertTriangle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { InvoiceDto, InvoiceStatus } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomerInvoicesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'paid'>('all');
  const [inspectInvoice, setInspectInvoice] = useState<InvoiceDto | null>(null);

  const {
    data: invoicesData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ invoices: InvoiceDto[] }>({
    queryKey: ['customer-invoices'],
    queryFn: async () => {
      const res = await apiClient.get('/api/invoices');
      return res.data.data;
    },
  });

  const invoices = invoicesData?.invoices || [];

  const openInvoices = invoices.filter(
    (inv) =>
      inv.status === InvoiceStatus.CONFIRMED || inv.status === InvoiceStatus.PARTIALLY_PAID,
  );
  const paidInvoices = invoices.filter((inv) => inv.status === InvoiceStatus.PAID);

  const displayedInvoices =
    activeTab === 'open'
      ? openInvoices
      : activeTab === 'paid'
        ? paidInvoices
        : invoices;

  const totalInvoiced = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paidAmount || 0), 0);
  const totalBalanceDue = invoices.reduce((acc, inv) => acc + Number(inv.balanceDue || 0), 0);
  const hasOverdue = invoices.some((inv) => inv.isOverdue);

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
        return <Badge variant="warning">UNPAID</Badge>;
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
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Billing Statements & Invoices</h1>
            <Badge variant="success">Customer Portal</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review recurring billing cycles, download tax receipts, and track payment settlement statuses.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overdue Warning Alert */}
      {hasOverdue && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="text-xs text-rose-200">
            <p className="font-semibold text-rose-100">Action Required: Overdue Invoices</p>
            <p className="mt-0.5 text-rose-300">
              One or more invoices have passed their payment due date. Please arrange settlement or contact billing support to maintain uninterrupted service.
            </p>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-slate-400">Total Invoiced</span>
            <div className="text-xl font-bold text-white mt-1">₹{totalInvoiced.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">{invoices.length} invoices issued</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-emerald-400">Total Paid</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">₹{totalPaid.toFixed(2)}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Successfully settled</span>
          </CardContent>
        </Card>

        <Card className={`border ${totalBalanceDue > 0 ? 'bg-amber-950/20 border-amber-800/40' : 'bg-slate-900/60 border-slate-800'}`}>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-400">Balance Due</span>
            <div className={`text-xl font-bold mt-1 ${totalBalanceDue > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
              ₹{totalBalanceDue.toFixed(2)}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Pending payment</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          All Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`pb-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'open'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Open & Unpaid ({openInvoices.length})
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`pb-3 px-4 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'paid'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Paid & Settled ({paidInvoices.length})
        </button>
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Loading your invoices..." />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">Unable to load invoices</p>
        </div>
      ) : displayedInvoices.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-12 text-center">
            <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No invoices found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {activeTab === 'open'
                ? 'Great news! You have no open or outstanding invoices.'
                : 'Invoices will appear here once your subscriptions begin their billing cycles.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedInvoices.map((inv) => (
            <div
              key={inv.id}
              className={`p-4 rounded-xl border transition-all ${
                inv.isOverdue
                  ? 'bg-rose-950/10 border-rose-800/40 hover:border-rose-700/60'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-white text-base">
                      {inv.invoiceNumber}
                    </span>
                    {getStatusBadge(inv)}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      Due: <strong className={inv.isOverdue ? 'text-rose-400' : 'text-slate-300'}>{new Date(inv.dueDate).toLocaleDateString()}</strong>
                    </span>
                    <span>
                      Period: {new Date(inv.periodStartDate).toLocaleDateString()} &mdash; {new Date(inv.periodEndDate).toLocaleDateString()}
                    </span>
                    {inv.subscription && (
                      <span className="font-mono text-indigo-400">
                        Sub: {inv.subscription.subscriptionNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Amount</div>
                    <div className="text-base font-bold font-mono text-white">
                      ₹{Number(inv.totalAmount).toFixed(2)}
                    </div>
                    {Number(inv.balanceDue) > 0 && (
                      <div className="text-[11px] font-mono font-semibold text-amber-300">
                        Bal: ₹{Number(inv.balanceDue).toFixed(2)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectInvoice(inv)}
                      className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrint(inv.id)}
                      className="flex items-center gap-1.5 text-xs text-indigo-300 border-indigo-800/60 hover:bg-indigo-950/40"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PDF Receipt
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Status:</span>
                {getStatusBadge(inspectInvoice)}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Due Date:</span>
                <span className={`font-mono font-medium ${inspectInvoice.isOverdue ? 'text-rose-400 font-bold' : 'text-white'}`}>
                  {new Date(inspectInvoice.dueDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Itemized Charges</h4>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 text-left">Description</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 text-right">Tax Rate</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {inspectInvoice.lines?.map((line) => (
                      <tr key={line.id} className="text-slate-300">
                        <td className="p-2.5">
                          <div className="font-medium text-white">{line.description}</div>
                        </td>
                        <td className="p-2.5 text-right font-mono">{line.quantity}</td>
                        <td className="p-2.5 text-right font-mono">₹{Number(line.unitPrice).toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono">{Number(line.taxRate)}%</td>
                        <td className="p-2.5 text-right font-mono font-medium text-white">
                          ₹{Number(line.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Breakdown */}
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

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handlePrint(inspectInvoice.id)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500"
              >
                <Printer className="w-4 h-4" />
                Print / Download PDF Receipt
              </Button>

              <Button variant="secondary" size="sm" onClick={() => setInspectInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
