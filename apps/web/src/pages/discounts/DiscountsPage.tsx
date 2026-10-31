import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Search,
  Plus,
  RefreshCw,
  Percent,
  Calendar,
  AlertTriangle,
  Play,
  Pause,
  Ticket,
} from 'lucide-react';
import { DiscountDto, DiscountType } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const DiscountsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form State for Creating Discount
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<DiscountType>(DiscountType.PERCENTAGE);
  const [newValue, setNewValue] = useState('');
  const [newMinSubtotal, setNewMinSubtotal] = useState('');
  const [newUsageLimit, setNewUsageLimit] = useState('');
  const [newValidFrom, setNewValidFrom] = useState('');
  const [newValidUntil, setNewValidUntil] = useState('');

  // 1. Fetch Discounts List
  const {
    data: discountsData,
    isLoading,
    error: fetchError,
    refetch,
    isFetching,
  } = useQuery<{ discounts: DiscountDto[] }>({
    queryKey: ['discounts-list', selectedStatusTab, selectedType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatusTab === 'ACTIVE') params.append('isActive', 'true');
      if (selectedStatusTab === 'INACTIVE') params.append('isActive', 'false');
      if (selectedType !== 'ALL') params.append('type', selectedType);
      const res = await apiClient.get(`/api/discounts?${params.toString()}`);
      return { discounts: res.data.data };
    },
  });

  // 2. Create Discount Mutation
  const createDiscountMutation = useMutation({
    mutationFn: async () => {
      if (!newCode.trim()) throw new Error('Discount code is required.');
      if (!newName.trim()) throw new Error('Discount campaign name is required.');
      const valNum = parseFloat(newValue);
      if (isNaN(valNum) || valNum <= 0) {
        throw new Error('Please enter a valid discount value greater than zero.');
      }
      if (newType === DiscountType.PERCENTAGE && valNum > 100) {
        throw new Error('Percentage discount cannot exceed 100%.');
      }

      await apiClient.post('/api/discounts', {
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        type: newType,
        value: valNum,
        minPurchaseAmount: newMinSubtotal ? parseFloat(newMinSubtotal) : undefined,
        usageLimit: newUsageLimit ? parseInt(newUsageLimit, 10) : undefined,
        validFrom: newValidFrom ? new Date(newValidFrom).toISOString() : undefined,
        validUntil: newValidUntil ? new Date(newValidUntil).toISOString() : undefined,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts-list'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ||
        (err as Error).message ||
        'Failed to create discount.';
      setActionError(msg);
    },
  });

  // 3. Toggle Active State Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.patch(`/api/discounts/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts-list'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to update discount status.';
      setActionError(msg);
    },
  });

  const resetForm = () => {
    setNewCode('');
    setNewName('');
    setNewDescription('');
    setNewType(DiscountType.PERCENTAGE);
    setNewValue('');
    setNewMinSubtotal('');
    setNewUsageLimit('');
    setNewValidFrom('');
    setNewValidUntil('');
    setActionError(null);
  };

  const discounts = discountsData?.discounts || [];

  // Filter client-side by search
  const filteredDiscounts = discounts.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q))
    );
  });

  // KPI calculations
  const totalCount = discounts.length;
  const activeCount = discounts.filter((d) => d.isActive).length;
  const totalRedemptions = discounts.reduce((sum, d) => sum + (d.usedCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-indigo-400" />
            Discounts & Promotional Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create coupon codes, enforce atomic concurrency usage limits, configure minimum subtotal thresholds, and track redemptions.
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
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500"
          >
            <Plus className="w-4 h-4" />
            Create Discount
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
            <span className="text-xs font-medium text-slate-400">Total Discounts</span>
            <div className="text-xl font-bold text-white mt-1">{totalCount}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Configured promotional campaigns</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-emerald-400">Active Coupons</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{activeCount}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Eligible for checkout redemption</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-indigo-400">Total Redemptions</span>
            <div className="text-xl font-bold text-indigo-300 mt-1">{totalRedemptions}</div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Coupons redeemed across orders</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-400">Active Rate</span>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {totalCount > 0 ? `${((activeCount / totalCount) * 100).toFixed(0)}%` : '0%'}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Enabled vs total promotions</span>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div className="flex items-center overflow-x-auto gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
            {[
              { id: 'ALL', label: 'All Status' },
              { id: 'ACTIVE', label: 'Active Only' },
              { id: 'INACTIVE', label: 'Paused / Inactive' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatusTab(tab.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                  selectedStatusTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <select
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
            <option value={DiscountType.FIXED_AMOUNT}>Fixed Amount (₹)</option>
          </select>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner message="Loading discounts & promotions..." />
        </div>
      ) : fetchError ? (
        <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-rose-500/20 text-rose-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">Failed to fetch discounts</p>
        </div>
      ) : filteredDiscounts.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="p-12 text-center">
            <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">No discount promotions found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No discounts match your current search filters.'
                : 'Click "Create Discount" to launch percentage discounts or fixed cash voucher promotions.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-800 bg-slate-950/60">
                <TableHead className="text-slate-400 font-semibold">Promo Code</TableHead>
                <TableHead className="text-slate-400 font-semibold">Campaign Name</TableHead>
                <TableHead className="text-slate-400 font-semibold">Value / Type</TableHead>
                <TableHead className="text-slate-400 font-semibold">Min Subtotal</TableHead>
                <TableHead className="text-slate-400 font-semibold">Usage / Limit</TableHead>
                <TableHead className="text-slate-400 font-semibold">Validity Window</TableHead>
                <TableHead className="text-slate-400 font-semibold">Status</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDiscounts.map((disc) => {
                const isMaxedOut =
                  disc.usageLimit !== null &&
                  disc.usageLimit !== undefined &&
                  disc.usedCount >= disc.usageLimit;

                return (
                  <TableRow
                    key={disc.id}
                    className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors"
                  >
                    <TableCell className="font-mono font-bold text-white">
                      <span className="px-2 py-1 rounded bg-indigo-950/60 border border-indigo-700/50 text-indigo-300">
                        {disc.code}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium text-white">{disc.name}</div>
                      {disc.description && (
                        <div className="text-xs text-slate-400 line-clamp-1">{disc.description}</div>
                      )}
                    </TableCell>

                    <TableCell>
                      {disc.type === DiscountType.PERCENTAGE ? (
                        <div className="flex items-center gap-1 font-mono font-bold text-emerald-400 text-sm">
                          <Percent className="w-3.5 h-3.5" />
                          <span>{Number(disc.value)}% Off</span>
                        </div>
                      ) : (
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          ₹{Number(disc.value).toFixed(2)} Off
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-xs font-mono text-slate-300">
                      {disc.minPurchaseAmount && Number(disc.minPurchaseAmount) > 0 ? (
                        <span>₹{Number(disc.minPurchaseAmount).toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-mono">
                        <span className="text-white font-medium">{disc.usedCount}</span>
                        <span className="text-slate-500">
                          {' '}/ {disc.usageLimit !== null && disc.usageLimit !== undefined ? disc.usageLimit : '∞'}
                        </span>
                      </div>
                      {isMaxedOut && (
                        <span className="text-[10px] text-rose-400 block font-semibold">Limit Reached</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400">
                      {disc.validUntil ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>Until {new Date(disc.validUntil).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">No expiration</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {disc.isActive ? (
                        isMaxedOut ? (
                          <Badge variant="warning">EXHAUSTED</Badge>
                        ) : (
                          <Badge variant="success">ACTIVE</Badge>
                        )
                      ) : (
                        <Badge variant="neutral">PAUSED</Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: disc.id,
                            isActive: !disc.isActive,
                          })
                        }
                        title={disc.isActive ? 'Pause Promotion' : 'Activate Promotion'}
                        className="text-slate-400 hover:text-white"
                      >
                        {disc.isActive ? (
                          <Pause className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Discount Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Discount Promotion"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Promo Code (Uppercase Alphanumeric)
                </label>
                <Input
                  placeholder="E.g., SAVE20, DIWALI500, WELCOME10"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Campaign Name
                </label>
                <Input
                  placeholder="E.g., Early Adopter 20% Off"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Description (Optional)
              </label>
              <Input
                placeholder="E.g., Applies to first month of subscription checkout"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Discount Type
                </label>
                <select
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as DiscountType)}
                >
                  <option value={DiscountType.PERCENTAGE}>Percentage (%)</option>
                  <option value={DiscountType.FIXED_AMOUNT}>Fixed Amount (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {newType === DiscountType.PERCENTAGE ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={newType === DiscountType.PERCENTAGE ? '100' : undefined}
                  placeholder={newType === DiscountType.PERCENTAGE ? '20' : '500.00'}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Min Purchase Subtotal (₹, Optional)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="E.g., 1000.00 (Optional)"
                  value={newMinSubtotal}
                  onChange={(e) => setNewMinSubtotal(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Max Redemption Limit (Optional)
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="E.g., 100 uses (Leave empty for unlimited)"
                  value={newUsageLimit}
                  onChange={(e) => setNewUsageLimit(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Valid From (Optional)
                </label>
                <Input
                  type="date"
                  value={newValidFrom}
                  onChange={(e) => setNewValidFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Valid Until (Expiration Date, Optional)
                </label>
                <Input
                  type="date"
                  value={newValidUntil}
                  onChange={(e) => setNewValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createDiscountMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => createDiscountMutation.mutate()}
                isLoading={createDiscountMutation.isPending}
                disabled={!newCode.trim() || !newName.trim() || !newValue.trim()}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                Launch Promo Code
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
