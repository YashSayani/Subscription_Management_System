import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Check,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { ProductDto, PlanDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomerCatalogPage: React.FC = () => {
  // Store selected variants for each product { [productId]: selectedVariantId[] }
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string[]>>({});
  // Store selected plan for each product { [productId]: planId }
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});

  // 1. Fetch available products
  const {
    data: productsData,
    isLoading: isProductsLoading,
    error: productsError,
  } = useQuery<{ products: ProductDto[] }>({
    queryKey: ['customer-products'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/products');
      return res.data.data;
    },
  });

  // 2. Fetch available plans
  const {
    data: plansData,
    isLoading: isPlansLoading,
  } = useQuery<{ plans: PlanDto[] }>({
    queryKey: ['customer-plans'],
    queryFn: async () => {
      const res = await apiClient.get('/api/catalog/plans');
      return res.data.data;
    },
  });

  const toggleVariant = (productId: string, variantId: string) => {
    setSelectedVariants((prev) => {
      const current = prev[productId] || [];
      const exists = current.includes(variantId);
      return {
        ...prev,
        [productId]: exists ? current.filter((id) => id !== variantId) : [...current, variantId],
      };
    });
  };

  const selectPlan = (productId: string, planId: string) => {
    setSelectedPlans((prev) => ({
      ...prev,
      [productId]: planId,
    }));
  };

  // Helper to calculate total unit price for a product
  const getProductPricing = (product: ProductDto) => {
    const base = Number(product.salesPrice);
    const chosenVariantIds = selectedVariants[product.id] || [];
    const activeVariants = product.variants.filter((v) => chosenVariantIds.includes(v.id));
    const adjustments = activeVariants.reduce((sum, v) => sum + Number(v.priceAdjustment), 0);
    const totalUnitPrice = base + adjustments;

    return {
      base,
      adjustments,
      totalUnitPrice,
      activeVariants,
    };
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Product & Subscription Catalog</h1>
          <Badge variant="success">Customer Portal</Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Explore enterprise subscription products, customize specification add-ons, and choose your billing cycle.
        </p>
      </div>

      {isProductsLoading && <LoadingSpinner message="Loading products and plan catalog..." />}

      {productsError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-400" />
          <span>Failed to load catalog offerings.</span>
        </div>
      )}

      {!isProductsLoading && (productsData?.products || []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-400 text-xs">
            No subscription products currently available. Please check back soon.
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {!isProductsLoading && (productsData?.products || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {productsData?.products.map((product) => {
            const pricing = getProductPricing(product);
            const chosenPlanId =
              selectedPlans[product.id] || plansData?.plans?.[0]?.id || '';
            const chosenPlan = plansData?.plans?.find((p) => p.id === chosenPlanId);

            return (
              <Card
                key={product.id}
                className="flex flex-col justify-between border-slate-800 bg-slate-900/40 hover:border-slate-700 transition"
              >
                <CardContent className="p-6">
                  {/* Product Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Package className="h-4 w-4" />
                        </div>
                        <h2 className="text-lg font-bold text-white">{product.name}</h2>
                      </div>
                      {product.description && (
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={product.type === 'SERVICE' ? 'info' : 'neutral'} size="sm">
                      {product.type}
                    </Badge>
                  </div>

                  {/* Configurable Variants Selector */}
                  {product.variants && product.variants.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        Available Add-ons & Specification Variants:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((variant) => {
                          const isSelected = (selectedVariants[product.id] || []).includes(variant.id);
                          return (
                            <button
                              key={variant.id}
                              onClick={() => toggleVariant(product.id, variant.id)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                isSelected
                                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                              }`}
                            >
                              <div
                                className={`h-3.5 w-3.5 rounded flex items-center justify-center border ${
                                  isSelected
                                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </div>
                              <span>
                                {variant.attributeName}: {variant.attributeValue}
                              </span>
                              <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                                (+₹{Number(variant.priceAdjustment).toFixed(2)})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Billing Frequency Selector */}
                  {!isPlansLoading && (plansData?.plans || []).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-400" />
                        Select Billing Cycle:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {plansData?.plans.map((plan) => {
                          const isPlanActive = chosenPlanId === plan.id;
                          return (
                            <button
                              key={plan.id}
                              onClick={() => selectPlan(product.id, plan.id)}
                              className={`p-2 rounded-lg text-xs font-medium border text-center transition ${
                                isPlanActive
                                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                                  : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              <div className="font-semibold">{plan.billingFrequency}</div>
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {plan.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Pricing Calculation Summary */}
                  <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Calculated Subscription Price</div>
                      <div className="text-2xl font-bold font-mono text-white mt-0.5">
                        ₹{pricing.totalUnitPrice.toFixed(2)}
                        <span className="text-xs font-normal text-slate-400 font-sans ml-1">
                          / {chosenPlan?.billingFrequency.toLowerCase() || 'cycle'}
                        </span>
                      </div>
                      {pricing.adjustments > 0 && (
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          Base ₹{pricing.base.toFixed(2)} + Add-ons ₹{pricing.adjustments.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                      onClick={() => {
                        alert(
                          `Ready to create Quotation for ${product.name} (Unit Price: ₹${pricing.totalUnitPrice.toFixed(2)}, Plan: ${chosenPlan?.billingFrequency}). Quotation conversion will execute in Step P6!`,
                        );
                      }}
                    >
                      Configure Quote
                    </Button>
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
