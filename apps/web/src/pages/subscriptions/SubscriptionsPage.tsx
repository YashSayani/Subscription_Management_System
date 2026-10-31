import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Play,
  Pause,
  Eye,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  SubscriptionDto,
  SubscriptionStatus,
  ProductDto,
  PlanDto,
} from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const SubscriptionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectSubscription, setInspectSubscription] = useState<SubscriptionDto | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Subscription Form State
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newPlanId, setNewPlanId] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newVariantId, setNewVariantId] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newStatus, setNewStatus] = useState<SubscriptionStatus>(SubscriptionStatus.QUOTATION);

  // 1. Fetch Subscriptions
  const {
    data: subData,
    isLoading: isSubLoading,
    error: subError,
  } = useQuery<{ subscriptions: SubscriptionDto[] }>({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const res = await apiClient.get('/api/subscriptions');
      return res.data.data;
    },
  });

  // 2. Fetch Catalog for creation modal
  const { data: productsData } = useQuery<{ products: ProductDto[] }>({
    queryKey: ['catalog-products'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/products');
      return res.data.data;
    },
  });

  const { data: plansData } = useQuery<{ plans: PlanDto[] }>({
    queryKey: ['catalog-plans'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/plans');
      return res.data.data;
    },
  });

  // 3. State Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      await apiClient.post(`/api/subscriptions/${id}/transition`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setInspectSubscription(null);
    },
  });

  // 4. Create Subscription Mutation
  const createSubMutation = useMutation({
    mutationFn: async () => {
      // Find customer by email or use existing
      const usersRes = await apiClient.get(`/api/users?search=${encodeURIComponent(newCustEmail)}`);
      const targetUser = usersRes.data.data?.[0];
      if (!targetUser) {
        throw new Error(`Customer with email '${newCustEmail}' not found.`);
      }

      await apiClient.post('/api/subscriptions', {
        customerId: targetUser.id,
        planId: newPlanId,
        status: newStatus,
        lines: [
          {
            productId: newProductId,
            variantId: newVariantId || undefined,
            quantity: Number(newQuantity),
            taxRate: 18.0,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
  });

  const resetCreateForm = () => {
    setNewCustEmail('');
    setNewPlanId('');
    setNewProductId('');
    setNewVariantId('');
    setNewQuantity(1);
    setNewStatus(SubscriptionStatus.QUOTATION);
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case SubscriptionStatus.DRAFT:
        return <Badge variant="neutral">DRAFT</Badge>;
      case SubscriptionStatus.QUOTATION:
        return <Badge variant="warning">QUOTATION</Badge>;
      case SubscriptionStatus.CONFIRMED:
        return <Badge variant="info">CONFIRMED</Badge>;
      case SubscriptionStatus.ACTIVE:
        return <Badge variant="success">ACTIVE</Badge>;
      case SubscriptionStatus.PAUSED:
        return <Badge variant="warning">PAUSED</Badge>;
      case SubscriptionStatus.CLOSED:
        return <Badge variant="danger">CLOSED</Badge>;
    }
  };

  const filteredSubscriptions = (subData?.subscriptions || []).filter((sub) => {
    const matchesStatus = selectedStatus === 'ALL' || sub.status === selectedStatus;
    const matchesSearch =
      sub.subscriptionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customer?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.customer?.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const selectedProduct = productsData?.products.find((p) => p.id === newProductId);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions & Lifecycle Workbench</h1>
            <Badge variant="info">State Machine Enforced</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track customer subscriptions through Draft, Quotation, Confirmed, Active, Paused, and Closed states.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Draft Quotation / Order
        </Button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center flex-wrap bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1">
          {['ALL', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedStatus === status
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search subscription # or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {isSubLoading && <LoadingSpinner message="Loading subscriptions..." />}

      {subError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400" />
          <span>Failed to load subscriptions.</span>
        </div>
      )}

      {!isSubLoading && filteredSubscriptions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-400 text-xs">
            No subscriptions matching the selected filter.
          </CardContent>
        </Card>
      )}

      {/* Subscriptions Table */}
      {!isSubLoading && filteredSubscriptions.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscription #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Billing Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing Cycle</TableHead>
              <TableHead>Total (Inc Tax)</TableHead>
              <TableHead className="text-right">Lifecycle Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscriptions.map((sub) => {
              const totalAmount = sub.lines.reduce(
                (sum, l) => sum + Number(l.totalAmount),
                0,
              );

              return (
                <TableRow key={sub.id}>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {sub.subscriptionNumber}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-semibold text-white text-xs">
                        {sub.customer?.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">{sub.customer?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-200">{sub.plan?.name}</div>
                    <Badge variant="neutral" size="sm" className="mt-0.5">
                      {sub.plan?.billingFrequency}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {sub.nextBillingDate ? (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3 text-emerald-400" />
                        {new Date(sub.nextBillingDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-white">
                    ₹{totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    {/* View Details */}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Inspect Details"
                      onClick={() => setInspectSubscription(sub)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>

                    {/* Transition Actions based on state */}
                    {sub.status === SubscriptionStatus.QUOTATION && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          transitionMutation.mutate({ id: sub.id, action: 'CONFIRM' })
                        }
                        isLoading={transitionMutation.isPending}
                      >
                        Confirm
                      </Button>
                    )}

                    {sub.status === SubscriptionStatus.CONFIRMED && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          transitionMutation.mutate({ id: sub.id, action: 'ACTIVATE' })
                        }
                        isLoading={transitionMutation.isPending}
                      >
                        <Play className="h-3 w-3 mr-1" /> Activate
                      </Button>
                    )}

                    {sub.status === SubscriptionStatus.ACTIVE && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            transitionMutation.mutate({ id: sub.id, action: 'PAUSE' })
                          }
                          isLoading={transitionMutation.isPending}
                        >
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() =>
                            transitionMutation.mutate({ id: sub.id, action: 'CLOSE' })
                          }
                          isLoading={transitionMutation.isPending}
                        >
                          Close
                        </Button>
                      </>
                    )}

                    {sub.status === SubscriptionStatus.PAUSED && (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            transitionMutation.mutate({ id: sub.id, action: 'RESUME' })
                          }
                          isLoading={transitionMutation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" /> Resume
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() =>
                            transitionMutation.mutate({ id: sub.id, action: 'CLOSE' })
                          }
                          isLoading={transitionMutation.isPending}
                        >
                          Close
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* INSPECT SUBSCRIPTION DETAIL MODAL */}
      {inspectSubscription && (
        <Modal
          isOpen={true}
          onClose={() => setInspectSubscription(null)}
          title={`Subscription ${inspectSubscription.subscriptionNumber}`}
          description={`State: ${inspectSubscription.status} • Customer: ${inspectSubscription.customer?.fullName}`}
        >
          <div className="space-y-4">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 block">Plan:</span>
                <span className="font-semibold text-white">
                  {inspectSubscription.plan?.name} ({inspectSubscription.plan?.billingFrequency})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Terms:</span>
                <span className="font-semibold text-white">
                  {inspectSubscription.paymentTermsDays} days
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Next Billing Cycle:</span>
                <span className="font-mono text-emerald-400">
                  {inspectSubscription.nextBillingDate
                    ? new Date(inspectSubscription.nextBillingDate).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Created On:</span>
                <span className="text-slate-300">
                  {new Date(inspectSubscription.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Line items table */}
            <div>
              <span className="text-xs font-semibold text-slate-300 mb-2 block">
                Line Items (Price Snapshots):
              </span>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2">Qty</th>
                      <th className="p-2">Unit Price</th>
                      <th className="p-2">Tax (18%)</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {inspectSubscription.lines.map((l) => (
                      <tr key={l.id} className="text-slate-300">
                        <td className="p-2">
                          <span className="font-semibold text-white">{l.product?.name}</span>
                          {l.variant && (
                            <span className="block text-[10px] text-emerald-400">
                              Variant: {l.variant.attributeName} = {l.variant.attributeValue} (+₹
                              {Number(l.variantAdjustment).toFixed(2)})
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono">{l.quantity}</td>
                        <td className="p-2 font-mono">₹{Number(l.unitPrice).toFixed(2)}</td>
                        <td className="p-2 font-mono">₹{Number(l.taxAmount).toFixed(2)}</td>
                        <td className="p-2 font-mono text-right text-emerald-400 font-semibold">
                          ₹{Number(l.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setInspectSubscription(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE QUOTATION / SUBSCRIPTION MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Draft Quotation / Subscription"
        description="Select customer, subscription plan, and line items with snapshot pricing."
      >
        <div className="space-y-4">
          <Input
            label="Customer Email Address *"
            placeholder="customer@company.com"
            value={newCustEmail}
            onChange={(e) => setNewCustEmail(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Subscription Plan *
            </label>
            <select
              value={newPlanId}
              onChange={(e) => setNewPlanId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Select Plan --</option>
              {plansData?.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.billingFrequency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Select Product *
            </label>
            <select
              value={newProductId}
              onChange={(e) => {
                setNewProductId(e.target.value);
                setNewVariantId('');
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Select Product --</option>
              {productsData?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Base ₹{Number(p.salesPrice).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Product Variant (Optional)
              </label>
              <select
                value={newVariantId}
                onChange={(e) => setNewVariantId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Standard (No Variant) --</option>
                {selectedProduct.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.attributeName}: {v.attributeValue} (+₹
                    {Number(v.priceAdjustment).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity *"
              type="number"
              min="1"
              value={newQuantity}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
            />
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Initial Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as SubscriptionStatus)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={SubscriptionStatus.QUOTATION}>QUOTATION</option>
                <option value={SubscriptionStatus.DRAFT}>DRAFT</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createSubMutation.mutate()}
              isLoading={createSubMutation.isPending}
              disabled={!newCustEmail || !newPlanId || !newProductId}
            >
              Create Agreement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
