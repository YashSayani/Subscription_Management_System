import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@brightloop/shared';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { StaffLayout } from './layouts/StaffLayout';
import { CustomerLayout } from './layouts/CustomerLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { CustomerCatalogPage } from './pages/customer/CustomerCatalogPage';

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner message="Checking authentication session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case UserRole.ADMIN:
      return <Navigate to="/admin" replace />;
    case UserRole.STAFF:
      return <Navigate to="/staff" replace />;
    case UserRole.CUSTOMER:
    default:
      return <Navigate to="/portal" replace />;
  }
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Root Redirect based on auth/role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="diagnostics" element={<DiagnosticsPage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route
                path="subscriptions"
                element={
                  <PlaceholderPage
                    title="Subscriptions & Lifecycle"
                    modulePhase="Step P6"
                    description="Track subscriptions through Draft, Quotation, Confirmed, Active, Paused, and Closed states."
                  />
                }
              />
              <Route
                path="invoices"
                element={
                  <PlaceholderPage
                    title="Invoices & Recurring Billing"
                    modulePhase="Step P8"
                    description="Automated invoice generation, tax snapshots, and payment tracking."
                  />
                }
              />
              <Route
                path="payments"
                element={
                  <PlaceholderPage
                    title="Manual Payments & Allocations"
                    modulePhase="Step P9"
                    description="Record manual bank transfers, cheques, and credit surplus ledger."
                  />
                }
              />
              <Route
                path="discounts"
                element={
                  <PlaceholderPage
                    title="Discounts & Promotions"
                    modulePhase="Step P10"
                    description="Fixed and percentage discount codes with atomic concurrent redemption limits."
                  />
                }
              />
              <Route
                path="staff"
                element={
                  <PlaceholderPage
                    title="Staff Management"
                    modulePhase="Step P3 Provisioning"
                    description="Admin-only internal staff user creation and role assignments."
                  />
                }
              />
            </Route>
          </Route>

          {/* Staff Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.STAFF]} />}>
            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffDashboard />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route
                path="subscriptions"
                element={
                  <PlaceholderPage
                    title="Quotations & Subscriptions"
                    modulePhase="Step P6"
                    description="Draft quotes, convert to subscriptions, and manage agreements."
                  />
                }
              />
              <Route
                path="invoices"
                element={
                  <PlaceholderPage
                    title="Invoices & Statements"
                    modulePhase="Step P8"
                    description="Review billing cycles, due dates, and settlement statuses."
                  />
                }
              />
              <Route
                path="payments"
                element={
                  <PlaceholderPage
                    title="Record Payments"
                    modulePhase="Step P9"
                    description="Log manual payment receipts and allocate directly to open invoices."
                  />
                }
              />
              <Route
                path="customers"
                element={
                  <PlaceholderPage
                    title="Customer Accounts"
                    modulePhase="Step P6"
                    description="View customer contact profiles and credit balances."
                  />
                }
              />
            </Route>
          </Route>

          {/* Customer Portal Routes */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.CUSTOMER]} />}>
            <Route path="/portal" element={<CustomerLayout />}>
              <Route index element={<CustomerDashboard />} />
              <Route path="catalog" element={<CustomerCatalogPage />} />
              <Route
                path="invoices"
                element={
                  <PlaceholderPage
                    title="Billing & Invoices"
                    modulePhase="Step P8"
                    description="View recurring invoices, payments, and PDF receipts."
                  />
                }
              />
              <Route
                path="profile"
                element={
                  <PlaceholderPage
                    title="My Account & Credit Ledger"
                    modulePhase="Step P12"
                    description="Manage customer details, billing tax ID, and available credits."
                  />
                }
              />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
