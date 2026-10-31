-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL_BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "BillingAttemptStatus" AS ENUM ('SUCCESS', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "company_name" TEXT,
    "tax_id" TEXT,
    "billing_address" TEXT,
    "credit_balance" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_reset_token" TEXT,
    "password_reset_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SERVICE',
    "sales_price" DECIMAL(14,2) NOT NULL,
    "cost_price" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "attribute_name" TEXT NOT NULL,
    "attribute_value" TEXT NOT NULL,
    "price_adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billing_frequency" "BillingFrequency" NOT NULL,
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "auto_close" BOOLEAN NOT NULL DEFAULT false,
    "pause_allowed" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_lines" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "subscription_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "quote_valid_until" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
    "paused_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_lines" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "variant_adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "period_start_date" TIMESTAMP(3) NOT NULL,
    "period_end_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "discount_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "variant_adjustment" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "payment_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "min_purchase_amount" DECIMAL(14,2),
    "min_quantity" INTEGER,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_attempts" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "attempt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BillingAttemptStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "products_is_available_deleted_at_idx" ON "products"("is_available", "deleted_at");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_available_idx" ON "product_variants"("product_id", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_attribute_name_attribute_value_key" ON "product_variants"("product_id", "attribute_name", "attribute_value");

-- CreateIndex
CREATE INDEX "plans_billing_frequency_is_active_idx" ON "plans"("billing_frequency", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_subscription_number_key" ON "subscriptions"("subscription_number");

-- CreateIndex
CREATE INDEX "subscriptions_customer_id_status_idx" ON "subscriptions"("customer_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_next_billing_date_idx" ON "subscriptions"("status", "next_billing_date");

-- CreateIndex
CREATE INDEX "subscriptions_subscription_number_idx" ON "subscriptions"("subscription_number");

-- CreateIndex
CREATE INDEX "subscription_lines_subscription_id_idx" ON "subscription_lines"("subscription_id");

-- CreateIndex
CREATE INDEX "subscription_lines_product_id_idx" ON "subscription_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_customer_id_status_due_date_idx" ON "invoices"("customer_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_status_idx" ON "invoices"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "invoices_due_date_idx" ON "invoices"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_subscription_id_period_start_date_key" ON "invoices"("subscription_id", "period_start_date");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_product_id_idx" ON "invoice_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_number_key" ON "payments"("payment_number");

-- CreateIndex
CREATE INDEX "payments_customer_id_payment_date_idx" ON "payments"("customer_id", "payment_date");

-- CreateIndex
CREATE INDEX "payments_recorded_by_id_idx" ON "payments"("recorded_by_id");

-- CreateIndex
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_invoice_id_key" ON "payment_allocations"("payment_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");

-- CreateIndex
CREATE INDEX "discounts_code_is_active_idx" ON "discounts"("code", "is_active");

-- CreateIndex
CREATE INDEX "discounts_valid_until_idx" ON "discounts"("valid_until");

-- CreateIndex
CREATE INDEX "billing_attempts_subscription_id_attempt_date_idx" ON "billing_attempts"("subscription_id", "attempt_date");

-- CreateIndex
CREATE INDEX "billing_attempts_status_idx" ON "billing_attempts"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_lines" ADD CONSTRAINT "subscription_lines_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_lines" ADD CONSTRAINT "subscription_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_lines" ADD CONSTRAINT "subscription_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_attempts" ADD CONSTRAINT "billing_attempts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_attempts" ADD CONSTRAINT "billing_attempts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Custom PostgreSQL Sequences & Identifiers
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS "sub_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "inv_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "pay_seq" START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_subscription_number() RETURNS TEXT AS $$
BEGIN
    RETURN 'SUB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('sub_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number() RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('inv_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_payment_number() RETURNS TEXT AS $$
BEGIN
    RETURN 'PAY-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('pay_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Custom SQL CHECK Constraints (Financial & Business Integrity)
-- ============================================================================
ALTER TABLE "users"
    ADD CONSTRAINT "users_credit_balance_check" CHECK ("credit_balance" >= 0);

ALTER TABLE "products"
    ADD CONSTRAINT "products_sales_price_check" CHECK ("sales_price" >= 0),
    ADD CONSTRAINT "products_cost_price_check" CHECK ("cost_price" >= 0);

ALTER TABLE "plans"
    ADD CONSTRAINT "plans_min_quantity_check" CHECK ("min_quantity" >= 1);

ALTER TABLE "subscription_lines"
    ADD CONSTRAINT "subscription_lines_quantity_check" CHECK ("quantity" >= 1),
    ADD CONSTRAINT "subscription_lines_unit_price_check" CHECK ("unit_price" >= 0),
    ADD CONSTRAINT "subscription_lines_tax_rate_check" CHECK ("tax_rate" >= 0 AND "tax_rate" <= 100),
    ADD CONSTRAINT "subscription_lines_subtotal_check" CHECK ("subtotal" >= 0),
    ADD CONSTRAINT "subscription_lines_total_amount_check" CHECK ("total_amount" >= 0);

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_subtotal_check" CHECK ("subtotal" >= 0),
    ADD CONSTRAINT "invoices_discount_amount_check" CHECK ("discount_amount" >= 0),
    ADD CONSTRAINT "invoices_tax_amount_check" CHECK ("tax_amount" >= 0),
    ADD CONSTRAINT "invoices_total_amount_check" CHECK ("total_amount" >= 0),
    ADD CONSTRAINT "invoices_paid_amount_check" CHECK ("paid_amount" >= 0),
    ADD CONSTRAINT "invoices_paid_lte_total_check" CHECK ("paid_amount" <= "total_amount");

ALTER TABLE "invoice_lines"
    ADD CONSTRAINT "invoice_lines_quantity_check" CHECK ("quantity" >= 1),
    ADD CONSTRAINT "invoice_lines_unit_price_check" CHECK ("unit_price" >= 0),
    ADD CONSTRAINT "invoice_lines_tax_rate_check" CHECK ("tax_rate" >= 0 AND "tax_rate" <= 100),
    ADD CONSTRAINT "invoice_lines_subtotal_check" CHECK ("subtotal" >= 0),
    ADD CONSTRAINT "invoice_lines_total_amount_check" CHECK ("total_amount" >= 0);

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0);

ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_amount_check" CHECK ("amount" > 0);

ALTER TABLE "discounts"
    ADD CONSTRAINT "discounts_value_check" CHECK ("value" > 0),
    ADD CONSTRAINT "discounts_used_count_check" CHECK ("used_count" >= 0),
    ADD CONSTRAINT "discounts_usage_limit_check" CHECK ("usage_limit" IS NULL OR "usage_limit" >= 1);
