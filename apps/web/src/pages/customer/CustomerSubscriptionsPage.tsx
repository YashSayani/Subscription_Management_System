import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubscriptionDto, SubscriptionStatus } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomerSubscriptionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'quotes' | 'active' | 'all'>('quotes');

  const {
    data: subData,
    isLoading,
    error,
  } = useQuery<{ subscriptions: SubscriptionDto[] }>({
    queryKey: ['customer-subscriptions'],
    queryFn: async () => {
      const res = await apiClient.get('/api/subscriptions');
      return res.data.data;
    },
  });

  const confirmQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/subscriptions/${id}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
    },
  });

  const closeSubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/api/subscriptions/${id}/transition`, { action: 'CLOSE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
    },
  });

  const allSubs = subData?.subscriptions || [];
  const openQuotes = allSubs.filter((s) => s.status === SubscriptionStatus.QUOTATION);
  const activeSubs = allSubs.filter(
    (s) => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.CONFIRMED,
  );

  const displayedSubs =
    activeTab === 'quotes'
      ? openQuotes
      : activeTab === 'active'
        ? activeSubs
        : allSubs;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">My Subscriptions & Quotes</h1>
            <Badge variant="success">Customer Portal</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Review subscription quotations, confirm terms, and manage active SaaS service agreements.
          </p>
        </div>

        <Link to="/portal/catalog">
          <Button size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
            Browse Software Catalog
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('quotes')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'quotes'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" /> Open Quotes ({openQuotes.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'active'
              ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Active Services ({activeSubs.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
            activeTab === 'all'
              ? 'bg-slate-800 text-white font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>All Agreements ({allSubs.length})</span>
        </button>
      </div>

      {isLoading && <LoadingSpinner message="Loading your subscription records..." />}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400" />
          <span>Failed to load subscriptions.</span>
        </div>
      )}

      {!isLoading && displayedSubs.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No agreements found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {activeTab === 'quotes'
                ? "You don't have any pending quotations. Configure a product from our catalog to request one."
                : 'No active subscription agreements currently in this view.'}
            </p>
            <Link to="/portal/catalog">
              <Button size="sm">Explore Products & Plans</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Subscription Cards List */}
      {!isLoading && displayedSubs.length > 0 && (
        <div className="space-y-4">
          {displayedSubs.map((sub) => {
            const totalAmount = sub.lines.reduce(
              (sum, l) => sum + Number(l.totalAmount),
              0,
            );
            const isQuotation = sub.status === SubscriptionStatus.QUOTATION;
            const isActive = sub.status === SubscriptionStatus.ACTIVE;

            return (
              <Card
                key={sub.id}
                className={`border-slate-800 ${
                  isQuotation
                    ? 'border-amber-500/30 bg-slate-900/40'
                    : isActive
                      ? 'border-emerald-500/30 bg-slate-900/40'
                      : 'bg-slate-900/20'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-400">
                            {sub.subscriptionNumber}
                          </span>
                          <Badge
                            variant={
                              isQuotation
                                ? 'warning'
                                : isActive
                                  ? 'success'
                                  : sub.status === SubscriptionStatus.CONFIRMED
                                    ? 'info'
                                    : 'neutral'
                            }
                            size="sm"
                          >
                            {sub.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Billing Frequency: <span className="text-slate-200 font-semibold">{sub.plan?.billingFrequency}</span> • Plan: {sub.plan?.name}
                        </div>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-400">Total Contract Value (Inc Tax)</div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">
                        ₹{totalAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Lines list */}
                  <div className="py-4 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Subscribed Line Items:
                    </span>
                    {sub.lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">{line.product?.name}</span>
                          {line.variant && (
                            <span className="text-[11px] text-emerald-400 ml-2">
                              ({line.variant.attributeName}: {line.variant.attributeValue})
                            </span>
                          )}
                          <span className="text-slate-400 text-[11px] ml-2">
                            × {line.quantity}
                          </span>
                        </div>
                        <div className="font-mono text-slate-300">
                          ₹{Number(line.totalAmount).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer & Actions */}
                  <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      {sub.nextBillingDate && (
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="h-3.5 w-3.5 text-blue-400" />
                          Next Cycle: {new Date(sub.nextBillingDate).toLocaleDateString()}
                        </span>
                      )}
                      {sub.quoteValidUntil && isQuotation && (
                        <span className="flex items-center gap-1 font-mono text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Quote Valid Until: {new Date(sub.quoteValidUntil).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isQuotation && (
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<CheckCircle2 className="h-4 w-4" />}
                          onClick={() => confirmQuoteMutation.mutate(sub.id)}
                          isLoading={confirmQuoteMutation.isPending}
                        >
                          Confirm Quote & Place Order
                        </Button>
                      )}

                      {(isActive || isQuotation) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to cancel this agreement?')) {
                              closeSubMutation.mutate(sub.id);
                            }
                          }}
                          isLoading={closeSubMutation.isPending}
                        >
                          Cancel Agreement
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
