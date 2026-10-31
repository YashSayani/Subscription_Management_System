import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Check,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { ProductDto, PlanDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const CustomerCatalogPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Store selected variants for each product { [productId]: selectedVariantId[] }
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string[]>>({});
  // Store selected plan for each product { [productId]: planId }
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});

  // Coupon state per product card
  const [couponInputs, setCouponInputs] = useState<Record<string, string>>({});
  const [appliedDiscounts, setAppliedDiscounts] = useState<
    Record<string, { code: string; name: string; discountAmount: string; newSubtotal: string } | null>
  >({});
  const [couponErrors, setCouponErrors] = useState<Record<string, string | null>>({});
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<Record<string, boolean>>({});

  const requestQuoteMutation = useMutation({
    mutationFn: async ({
      productId,
      planId,
      variantId,
      discountCode,
    }: {
      productId: string;
      planId: string;
      variantId?: string;
      discountCode?: string;
    }) => {
      await apiClient.post('/api/subscriptions', {
        planId,
        status: 'QUOTATION',
        discountCode,
        lines: [
          {
            productId,
            variantId: variantId || undefined,
            quantity: 1,
            taxRate: 18.0,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
      navigate('/portal');
    },
  });

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

    const adjustments = (product.variants || [])
      .filter((v) => chosenVariantIds.includes(v.id))
      .reduce((acc, v) => acc + Number(v.priceAdjustment), 0);

    return {
      base,
      adjustments,
      totalUnitPrice: base + adjustments,
    };
  };

  const handleValidateCoupon = async (productId: string, subtotal: number) => {
    const code = (couponInputs[productId] || '').trim().toUpperCase();
    if (!code) return;

    setCouponErrors((prev) => ({ ...prev, [productId]: null }));
    setIsValidatingCoupon((prev) => ({ ...prev, [productId]: true }));

    try {
      const res = await apiClient.post('/api/discounts/validate', {
        code,
        subtotal,
      });
      setAppliedDiscounts((prev) => ({ ...prev, [productId]: res.data.data }));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err as Error).message ||
        'Invalid coupon code';
      setCouponErrors((prev) => ({ ...prev, [productId]: msg }));
      setAppliedDiscounts((prev) => ({ ...prev, [productId]: null }));
    } finally {
      setIsValidatingCoupon((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleRemoveCoupon = (productId: string) => {
    setAppliedDiscounts((prev) => ({ ...prev, [productId]: null }));
    setCouponInputs((prev) => ({ ...prev, [productId]: '' }));
    setCouponErrors((prev) => ({ ...prev, [productId]: null }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Software Solutions Catalog</h1>
        <p className="text-xs text-slate-400 mt-1">
          Select enterprise software modules, customize service specifications, apply promo coupons, and request your subscription quotation.
        </p>
      </div>

      {/* Products Grid */}
      {isProductsLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner message="Loading software catalog..." />
        </div>
      ) : productsError ? (
        <div className="p-6 text-center bg-slate-900/50 rounded-xl border border-rose-500/20 text-rose-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
          <p className="font-semibold">Unable to load software catalog.</p>
        </div>
      ) : (productsData?.products || []).length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800 text-slate-400">
          No software products available for subscription at this time.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {productsData?.products.map((product) => {
            const pricing = getProductPricing(product);
            const chosenPlanId =
              selectedPlans[product.id] || plansData?.plans?.[0]?.id || '';
            const chosenPlan = plansData?.plans?.find((p) => p.id === chosenPlanId);
            const appliedDiscount = appliedDiscounts[product.id];

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

                  {/* Promo / Discount Coupon Section */}
                  <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-indigo-400" />
                        Promotional Coupon Code:
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Try SAVE20 or FLAT500</span>
                    </div>

                    {appliedDiscount ? (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-emerald-400 font-medium">
                          <Check className="h-3.5 w-3.5" />
                          <span>
                            Coupon <strong className="font-mono text-emerald-300">{appliedDiscount.code}</strong> applied:
                            {' '}-₹{appliedDiscount.discountAmount} ({appliedDiscount.name})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCoupon(product.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-400 font-medium ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Enter coupon code (e.g. SAVE20)"
                          value={couponInputs[product.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setCouponInputs((prev) => ({ ...prev, [product.id]: val }));
                            setCouponErrors((prev) => ({ ...prev, [product.id]: null }));
                          }}
                          className="font-mono uppercase text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isValidatingCoupon[product.id] || !couponInputs[product.id]?.trim()}
                          onClick={() => handleValidateCoupon(product.id, pricing.totalUnitPrice)}
                          className="shrink-0 text-xs border-indigo-700/60 hover:bg-indigo-950/40 text-indigo-300"
                        >
                          {isValidatingCoupon[product.id] ? 'Checking...' : 'Apply Coupon'}
                        </Button>
                      </div>
                    )}

                    {couponErrors[product.id] && (
                      <p className="text-[11px] text-rose-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {couponErrors[product.id]}
                      </p>
                    )}
                  </div>

                  {/* Dynamic Pricing Calculation Summary */}
                  <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Calculated Subscription Price</div>
                      {appliedDiscount ? (
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-2xl font-bold font-mono text-emerald-400">
                            ₹{(pricing.totalUnitPrice - parseFloat(appliedDiscount.discountAmount)).toFixed(2)}
                          </span>
                          <span className="text-xs line-through text-slate-500 font-mono">
                            ₹{pricing.totalUnitPrice.toFixed(2)}
                          </span>
                          <span className="text-xs font-normal text-slate-400 font-sans">
                            / {chosenPlan?.billingFrequency.toLowerCase() || 'cycle'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-2xl font-bold font-mono text-white mt-0.5">
                          ₹{pricing.totalUnitPrice.toFixed(2)}
                          <span className="text-xs font-normal text-slate-400 font-sans ml-1">
                            / {chosenPlan?.billingFrequency.toLowerCase() || 'cycle'}
                          </span>
                        </div>
                      )}
                      {pricing.adjustments > 0 && (
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          Base ₹{pricing.base.toFixed(2)} + Add-ons ₹{pricing.adjustments.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                      isLoading={requestQuoteMutation.isPending}
                      onClick={() => {
                        const chosenVariantId = selectedVariants[product.id]?.[0];
                        requestQuoteMutation.mutate({
                          productId: product.id,
                          planId: chosenPlanId,
                          variantId: chosenVariantId,
                          discountCode: appliedDiscount ? appliedDiscount.code : undefined,
                        });
                      }}
                    >
                      Request Quotation
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
