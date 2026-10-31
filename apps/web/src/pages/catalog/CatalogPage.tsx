import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Trash2,
  Tag,
  Calendar,
  AlertCircle,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  ProductDto,
  PlanDto,
  BillingFrequency,
} from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CatalogPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'products' | 'plans'>('products');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<ProductDto | null>(null);

  // New Product Form state
  const [newProductName, setNewProductName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductType, setNewProductType] = useState<'SERVICE' | 'PHYSICAL'>('SERVICE');
  const [newProductSalesPrice, setNewProductSalesPrice] = useState('1500.00');
  const [newProductCostPrice, setNewProductCostPrice] = useState('300.00');
  const [newProductVariants, setNewProductVariants] = useState<
    Array<{ attributeName: string; attributeValue: string; priceAdjustment: number }>
  >([
    { attributeName: 'Brand', attributeValue: 'Odoo', priceAdjustment: 560.0 },
  ]);

  // New Variant Form state
  const [newVariantAttrName, setNewVariantAttrName] = useState('');
  const [newVariantAttrValue, setNewVariantAttrValue] = useState('');
  const [newVariantAdjustment, setNewVariantAdjustment] = useState('0.00');

  // New Plan Form state
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');
  const [newPlanFrequency, setNewPlanFrequency] = useState<BillingFrequency>(BillingFrequency.MONTHLY);
  const [newPlanMinQty, setNewPlanMinQty] = useState(1);
  const [newPlanPauseAllowed, setNewPlanPauseAllowed] = useState(true);
  const [newPlanAutoClose, setNewPlanAutoClose] = useState(false);

  // 1. Fetch Products
  const {
    data: productsData,
    isLoading: isProductsLoading,
    error: productsError,
  } = useQuery<{ products: ProductDto[] }>({
    queryKey: ['catalog-products'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/products?includeArchived=true');
      return res.data.data;
    },
  });

  // 2. Fetch Plans
  const {
    data: plansData,
    isLoading: isPlansLoading,
    error: plansError,
  } = useQuery<{ plans: PlanDto[] }>({
    queryKey: ['catalog-plans'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/plans?includeArchived=true');
      return res.data.data;
    },
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/catalog/products', {
        name: newProductName,
        description: newProductDesc || undefined,
        type: newProductType,
        salesPrice: Number(newProductSalesPrice),
        costPrice: Number(newProductCostPrice),
        variants: newProductVariants.length > 0 ? newProductVariants : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      setIsProductModalOpen(false);
      resetProductForm();
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.delete(`/api/catalog/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
    },
  });

  const addVariantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductForVariants) return;
      await apiClient.post(`/api/catalog/products/${selectedProductForVariants.id}/variants`, {
        attributeName: newVariantAttrName,
        attributeValue: newVariantAttrValue,
        priceAdjustment: Number(newVariantAdjustment),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      setNewVariantAttrName('');
      setNewVariantAttrValue('');
      setNewVariantAdjustment('0.00');
      // Update local selected product reference
      setSelectedProductForVariants(null);
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (variantId: string) => {
      await apiClient.delete(`/api/catalog/variants/${variantId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      setSelectedProductForVariants(null);
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/catalog/plans', {
        name: newPlanName,
        description: newPlanDesc || undefined,
        billingFrequency: newPlanFrequency,
        minQuantity: Number(newPlanMinQty),
        pauseAllowed: newPlanPauseAllowed,
        autoClose: newPlanAutoClose,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-plans'] });
      setIsPlanModalOpen(false);
      resetPlanForm();
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiClient.delete(`/api/catalog/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-plans'] });
    },
  });

  const resetProductForm = () => {
    setNewProductName('');
    setNewProductDesc('');
    setNewProductType('SERVICE');
    setNewProductSalesPrice('1500.00');
    setNewProductCostPrice('300.00');
    setNewProductVariants([{ attributeName: 'Brand', attributeValue: 'Odoo', priceAdjustment: 560.0 }]);
  };

  const resetPlanForm = () => {
    setNewPlanName('');
    setNewPlanDesc('');
    setNewPlanFrequency(BillingFrequency.MONTHLY);
    setNewPlanMinQty(1);
    setNewPlanPauseAllowed(true);
    setNewPlanAutoClose(false);
  };

  const filteredProducts = (productsData?.products || []).filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Products & Plans Catalog</h1>
            <Badge variant="info">Modular Catalog</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure subscription software, configurable variant price adjustments, and recurring billing frequencies.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setIsProductModalOpen(true)}
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Product
            </Button>
            <Button
              onClick={() => setIsPlanModalOpen(true)}
              variant="secondary"
              size="sm"
              leftIcon={<Calendar className="h-4 w-4" />}
            >
              Add Plan
            </Button>
          </div>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'products'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Products ({productsData?.products?.length || 0})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition ${
              activeTab === 'plans'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Plans ({plansData?.plans?.length || 0})
            </span>
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        )}
      </div>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <>
          {isProductsLoading && <LoadingSpinner message="Loading catalog products..." />}

          {productsError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>Failed to load products from API.</span>
            </div>
          )}

          {!isProductsLoading && filteredProducts.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-slate-400 text-xs">
                No products found. Click "Add Product" to create your first subscription product.
              </CardContent>
            </Card>
          )}

          {!isProductsLoading && filteredProducts.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Base Sales Price</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Configurable Variants</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-white">{product.name}</span>
                        {product.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.type === 'SERVICE' ? 'info' : 'neutral'} size="sm">
                        {product.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400 font-semibold">
                      ₹{Number(product.salesPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">
                      ₹{Number(product.costPrice).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {product.variants?.map((v) => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                          >
                            <Tag className="h-3 w-3 text-emerald-400" />
                            <span>
                              {v.attributeName}: {v.attributeValue} (+₹
                              {Number(v.priceAdjustment).toFixed(2)})
                            </span>
                          </span>
                        ))}
                        {isAdmin && (
                          <button
                            onClick={() => setSelectedProductForVariants(product)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 ml-1 underline"
                          >
                            Edit Variants
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.isAvailable ? 'success' : 'danger'} size="sm">
                        {product.isAvailable ? 'Available' : 'Archived'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {product.isAvailable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => deleteProductMutation.mutate(product.id)}
                            isLoading={deleteProductMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <>
          {isPlansLoading && <LoadingSpinner message="Loading subscription plans..." />}

          {plansError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>Failed to load subscription plans from API.</span>
            </div>
          )}

          {!isPlansLoading && (plansData?.plans || []).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-slate-400 text-xs">
                No subscription plans configured. Click "Add Plan" to create one.
              </CardContent>
            </Card>
          )}

          {!isPlansLoading && (plansData?.plans || []).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plansData?.plans.map((plan) => (
                <Card key={plan.id} className="flex flex-col justify-between">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="neutral" size="sm">
                        {plan.billingFrequency}
                      </Badge>
                      <Badge variant={plan.isActive ? 'success' : 'danger'} size="sm">
                        {plan.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {plan.description}
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Min Quantity:</span>
                        <span className="font-semibold text-white">{plan.minQuantity}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Pause Allowed:</span>
                        <span className={plan.pauseAllowed ? 'text-emerald-400' : 'text-slate-500'}>
                          {plan.pauseAllowed ? 'Yes (No backfill)' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Auto-Close:</span>
                        <span className="text-white">{plan.autoClose ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    </div>
                  </CardContent>

                  {isAdmin && plan.isActive && (
                    <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/30 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300"
                        onClick={() => deletePlanMutation.mutate(plan.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Archive Plan
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* CREATE PRODUCT MODAL */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Add New Subscription Product"
        description="Configure base pricing, product type, and initial brand/variant adjustments."
      >
        <div className="space-y-4">
          <Input
            label="Product Name *"
            placeholder="e.g. Brightloop ERP Platform"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
          />

          <Input
            label="Description"
            placeholder="Cloud ERP solution for mid-market..."
            value={newProductDesc}
            onChange={(e) => setNewProductDesc(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Base Sales Price (₹) *"
              type="number"
              step="0.01"
              value={newProductSalesPrice}
              onChange={(e) => setNewProductSalesPrice(e.target.value)}
            />
            <Input
              label="Cost Price (₹) *"
              type="number"
              step="0.01"
              value={newProductCostPrice}
              onChange={(e) => setNewProductCostPrice(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Product Type</label>
            <select
              value={newProductType}
              onChange={(e) => setNewProductType(e.target.value as 'SERVICE' | 'PHYSICAL')}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="SERVICE">SERVICE (Cloud / Subscription)</option>
              <option value="PHYSICAL">PHYSICAL (Hardware / Tangible)</option>
            </select>
          </div>

          {/* Configurable Initial Variants */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Initial Configurable Variant
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              e.g., Brand "Odoo" adds ₹560.00 to base price. Adjustments are database-driven.
            </p>
            {newProductVariants.map((v, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 text-xs">
                <input
                  placeholder="Attribute (e.g. Brand)"
                  value={v.attributeName}
                  onChange={(e) => {
                    const copy = [...newProductVariants];
                    copy[i].attributeName = e.target.value;
                    setNewProductVariants(copy);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                />
                <input
                  placeholder="Value (e.g. Odoo)"
                  value={v.attributeValue}
                  onChange={(e) => {
                    const copy = [...newProductVariants];
                    copy[i].attributeValue = e.target.value;
                    setNewProductVariants(copy);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                />
                <input
                  type="number"
                  placeholder="Price Adj (₹)"
                  value={v.priceAdjustment}
                  onChange={(e) => {
                    const copy = [...newProductVariants];
                    copy[i].priceAdjustment = Number(e.target.value);
                    setNewProductVariants(copy);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setIsProductModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createProductMutation.mutate()}
              isLoading={createProductMutation.isPending}
              disabled={!newProductName || !newProductSalesPrice}
            >
              Save Product
            </Button>
          </div>
        </div>
      </Modal>

      {/* CREATE PLAN MODAL */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title="Add New Subscription Plan"
        description="Set billing frequency interval and subscription lifecycle rules."
      >
        <div className="space-y-4">
          <Input
            label="Plan Name *"
            placeholder="e.g. Monthly Standard"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
          />

          <Input
            label="Description"
            placeholder="Billed monthly in advance..."
            value={newPlanDesc}
            onChange={(e) => setNewPlanDesc(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Billing Frequency *
            </label>
            <select
              value={newPlanFrequency}
              onChange={(e) => setNewPlanFrequency(e.target.value as BillingFrequency)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="DAILY">DAILY</option>
              <option value="WEEKLY">WEEKLY</option>
              <option value="MONTHLY">MONTHLY</option>
              <option value="YEARLY">YEARLY</option>
            </select>
          </div>

          <Input
            label="Minimum Quantity"
            type="number"
            min="1"
            value={newPlanMinQty}
            onChange={(e) => setNewPlanMinQty(Number(e.target.value))}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="pauseAllowed"
              checked={newPlanPauseAllowed}
              onChange={(e) => setNewPlanPauseAllowed(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="pauseAllowed" className="text-xs text-slate-300">
              Allow Pausing (Stops billing with no backfill upon resume)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <Button variant="ghost" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createPlanMutation.mutate()}
              isLoading={createPlanMutation.isPending}
              disabled={!newPlanName}
            >
              Save Plan
            </Button>
          </div>
        </div>
      </Modal>

      {/* MANAGE VARIANTS MODAL */}
      {selectedProductForVariants && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedProductForVariants(null)}
          title={`Variants for ${selectedProductForVariants.name}`}
          description="Manage configurable brand and specification pricing adjustments."
        >
          <div className="space-y-4">
            {/* List existing variants */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Active Variants:</span>
              {selectedProductForVariants.variants?.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-medium text-white">{v.attributeName}:</span>
                    <span className="text-slate-300">{v.attributeValue}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-emerald-400 font-semibold">
                      +₹{Number(v.priceAdjustment).toFixed(2)}
                    </span>
                    <button
                      onClick={() => deleteVariantMutation.mutate(v.id)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new variant form */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
              <span className="text-xs font-semibold text-white block">Add Variant:</span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Attribute Name"
                  placeholder="e.g. Hosting"
                  value={newVariantAttrName}
                  onChange={(e) => setNewVariantAttrName(e.target.value)}
                />
                <Input
                  label="Attribute Value"
                  placeholder="e.g. Dedicated"
                  value={newVariantAttrValue}
                  onChange={(e) => setNewVariantAttrValue(e.target.value)}
                />
              </div>
              <Input
                label="Price Adjustment (₹)"
                type="number"
                step="0.01"
                placeholder="400.00"
                value={newVariantAdjustment}
                onChange={(e) => setNewVariantAdjustment(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={() => addVariantMutation.mutate()}
                isLoading={addVariantMutation.isPending}
                disabled={!newVariantAttrName || !newVariantAttrValue}
              >
                Add Variant
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
