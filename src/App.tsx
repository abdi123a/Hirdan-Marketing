import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PermissionGate } from "@/components/PermissionGate";
import { useAuthStore } from "@/lib/auth-store";

import { useState, useEffect, lazy, Suspense } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

// Core static layouts and public/login pages to keep initial bundle load instantaneous
import NotFound from "./pages/NotFound.tsx";
import AdminLoginPage from "./pages/AdminLoginPage.tsx";
import ClientLoginPage from "./pages/ClientLoginPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import DashboardLayout from "./components/DashboardLayout.tsx";
import { AgencyAppearanceManager } from "./components/AgencyAppearanceManager.tsx";
import { GlobalUploadProgress } from "./components/GlobalUploadProgress.tsx";
import VerifyDocumentPage from "./pages/VerifyDocumentPage.tsx";
import ShareDownload from "./pages/ShareDownload.tsx";

// Lazy-loaded pages (code splitting for admin/client features)
const ClientPortalPage = lazy(() => import("./pages/ClientPortalPage.tsx"));
const DashboardOverview = lazy(() => import("./pages/DashboardOverview.tsx"));
const ClientsPage = lazy(() => import("./pages/ClientsPage.tsx"));
const AddClientPage = lazy(() => import("./pages/AddClientPage.tsx"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage.tsx"));
const AddProjectPage = lazy(() => import("./pages/AddProjectPage.tsx"));
const TeamPage = lazy(() => import("./pages/TeamPage.tsx"));
const AddEmployeePage = lazy(() => import("./pages/AddEmployeePage.tsx"));
const EmployeeProfilePage = lazy(() => import("./pages/EmployeeProfilePage.tsx"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage.tsx"));
const AddInvoicePage = lazy(() => import("./pages/AddInvoicePage.tsx"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage.tsx"));
const AddSubscriptionPage = lazy(() => import("./pages/AddSubscriptionPage.tsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const AiAssistantPage = lazy(() => import("./pages/AiAssistantPage.tsx"));
const EditClientPage = lazy(() => import("./pages/EditClientPage.tsx"));
const EditProjectPage = lazy(() => import("./pages/EditProjectPage.tsx"));
const EditInvoicePage = lazy(() => import("./pages/EditInvoicePage.tsx"));
const EditSubscriptionPage = lazy(() => import("./pages/EditSubscriptionPage.tsx"));
const ProformaPage = lazy(() => import("./pages/ProformaPage.tsx"));
const PackagesPage = lazy(() => import("./pages/PackagesPage.tsx"));
const ServicesPage = lazy(() => import("./pages/ServicesPage.tsx"));
const AddProformaPage = lazy(() => import("./pages/AddProformaPage.tsx"));
const EditProformaPage = lazy(() => import("./pages/EditProformaPage.tsx"));
const AddPackagePage = lazy(() => import("./pages/AddPackagePage.tsx"));
const EditPackagePage = lazy(() => import("./pages/EditPackagePage.tsx"));
const AddServicePage = lazy(() => import("./pages/AddServicePage.tsx"));
const EditServicePage = lazy(() => import("./pages/EditServicePage.tsx"));
const ClientDetailsPage = lazy(() => import("./pages/ClientDetailsPage.tsx"));
const ProjectDetailsPage = lazy(() => import("./pages/ProjectDetailsPage.tsx"));
const InvoiceDetailsPage = lazy(() => import("./pages/InvoiceDetailsPage.tsx"));
const ProformaDetailsPage = lazy(() => import("./pages/ProformaDetailsPage.tsx"));
const SubscriptionDetailsPage = lazy(() => import("./pages/SubscriptionDetailsPage.tsx"));
const PackageDetailsPage = lazy(() => import("./pages/PackageDetailsPage.tsx"));
const ServiceDetailsPage = lazy(() => import("./pages/ServiceDetailsPage.tsx"));
const LeadsPage = lazy(() => import("./pages/LeadsPage.tsx"));
const UsersPage = lazy(() => import('./pages/UsersPage.tsx'));
const AddUserPage = lazy(() => import('./pages/AddUserPage.tsx'));
const SocialMediaTasksPage = lazy(() => import('./pages/SocialMediaTasksPage.tsx'));
const SocialMediaPlannerPage = lazy(() => import('./pages/SocialMediaPlannerPage.tsx'));
const SocialAnalyzePage = lazy(() => import('./pages/SocialAnalyzePage.tsx'));
const SocialPublishPage = lazy(() => import('./pages/SocialPublishPage.tsx'));
const SocialAccountsPage = lazy(() => import('./pages/SocialAccountsPage.tsx'));
const SocialAccountPickerPage = lazy(() => import('./pages/SocialAccountPickerPage.tsx'));
const SocialStrategyPresentationStudioPage = lazy(() => import('./pages/SocialStrategyPresentationStudioPage.tsx'));
const SocialPerformanceReportPage = lazy(() => import("./pages/SocialPerformanceReportPage.tsx"));
const SocialAdSpendPage = lazy(() => import("./pages/SocialAdSpendPage.tsx"));
const FinancialReportPage = lazy(() => import("./pages/FinancialReportPage.tsx"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage.tsx"));
const HrDocumentsPage = lazy(() => import("@/pages/HrDocumentsPage.tsx"));
const GenerateHrDocumentPage = lazy(() => import("@/pages/GenerateHrDocumentPage.tsx"));
const FileTransfer = lazy(() => import("./pages/FileTransfer.tsx"));
const LandingPageEditor = lazy(() => import("./pages/LandingPageEditor.tsx"));
const PluginsPage = lazy(() => import("./pages/PluginsPage.tsx"));
const EmailCenterPage = lazy(() => import("./pages/EmailCenterPage.tsx"));
const EmailMailboxesPage = lazy(() => import("./pages/EmailMailboxesPage.tsx"));
const EmailTemplatesPage = lazy(() => import("./pages/EmailTemplatesPage.tsx"));
const EmailAnalyticsPage = lazy(() => import("./pages/EmailAnalyticsPage.tsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.tsx"));

const queryClient = new QueryClient();

function AppRoutes() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { fetchSettings } = useAgencyStore();

  useEffect(() => {
    const initializeApp = async () => {
      // Run auth verify and settings fetch in parallel for better performance
      try {
        const [authData] = await Promise.all([
          apiFetch<{ user: any }>('/auth/me'),
          fetchSettings()
        ]);

        if (authData.user) {
          useAuthStore.getState().setUserFromApi(authData.user);
        } else {
          logout();
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        // We still fetch settings even if auth fails, as login pages need them
        try { await fetchSettings(); } catch (sErr) { console.error("Settings fetch error:", sErr); }
        
        // Only logout if not authenticated or explicitly unauthorized. 
        // apiFetch handles 401s by calling store.logout() internally.
        if (!useAuthStore.getState().token) {
          logout();
        }
      } finally {
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        const MIN_LOADING_TIME = 2000; // 2 seconds minimum to appreciate the loader
        const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);

        setTimeout(() => {
          setIsInitializing(false);
          // Small delay for the fade-out effect to feel premium
          setTimeout(() => setShowLoader(false), 800);
        }, remainingDelay);
      }
    };

    const startTime = Date.now();
    initializeApp();
  }, [fetchSettings, logout]);

  const { settings } = useAgencyStore();

  useEffect(() => {
    if (settings?.oneSignalEnabled && settings?.oneSignalAppId) {
      if (!document.getElementById('onesignal-sdk')) {
        const script = document.createElement('script');
        script.id = 'onesignal-sdk';
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        script.onload = () => {
          const w = window as any;
          if (w.OneSignal) {
            w.OneSignal.init({
              appId: settings.oneSignalAppId,
              allowLocalhostAsSecureOrigin: true,
            }).then(() => {
              console.log('[OneSignal] Initialized successfully');
            }).catch((err: any) => {
              console.warn('[OneSignal] Initialization error:', err);
            });
          }
        };
        document.head.appendChild(script);
      }
    }
  }, [settings?.oneSignalEnabled, settings?.oneSignalAppId]);

  if (showLoader) {
    return <LoadingScreen fadeOut={!isInitializing} />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify/:token" element={<VerifyDocumentPage />} />
      <Route path="/v/:token" element={<VerifyDocumentPage />} />
      <Route path="/share/:shareId" element={<ShareDownload />} />
      <Route path="/f/:shareId" element={<ShareDownload />} />

      {/* Client portal (protected - client role) */}
      <Route
        path="/client/portal"
        element={
          <ProtectedRoute allowedRoles="client">
            <ClientPortalPage />
          </ProtectedRoute>
        }
      />

      {/* Agency dashboard (protected - admin, manager, staff roles) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PermissionGate module="dashboard"><DashboardOverview /></PermissionGate>} />
        <Route path="clients" element={<PermissionGate module="clients"><ClientsPage /></PermissionGate>} />
        <Route path="clients/add" element={<PermissionGate module="clients" minimum="WRITE"><AddClientPage /></PermissionGate>} />
        <Route path="clients/edit/:id" element={<PermissionGate module="clients" minimum="WRITE"><EditClientPage /></PermissionGate>} />
        <Route path="clients/view/:id" element={<PermissionGate module="clients"><ClientDetailsPage /></PermissionGate>} />

        {/* User Management */}
        <Route path="users" element={<Navigate to="/dashboard/settings?tab=users" replace />} />
        <Route path="users/add" element={
          <PermissionGate module="users" minimum="MANAGE">
            <AddUserPage />
          </PermissionGate>
        } />
        <Route path="users/edit/:id" element={
          <PermissionGate module="users" minimum="MANAGE">
            <AddUserPage />
          </PermissionGate>
        } />

        <Route path="projects" element={<PermissionGate module="projects"><ProjectsPage /></PermissionGate>} />
        <Route path="projects/add" element={<PermissionGate module="projects" minimum="WRITE"><AddProjectPage /></PermissionGate>} />
        <Route path="projects/edit/:id" element={<PermissionGate module="projects" minimum="WRITE"><EditProjectPage /></PermissionGate>} />
        <Route path="projects/view/:id" element={<PermissionGate module="projects"><ProjectDetailsPage /></PermissionGate>} />
        <Route path="team" element={<PermissionGate module="team"><TeamPage /></PermissionGate>} />
        <Route path="team/add" element={<PermissionGate module="team" minimum="WRITE"><AddEmployeePage /></PermissionGate>} />
        <Route path="team/edit/:id" element={<PermissionGate module="team" minimum="WRITE"><AddEmployeePage /></PermissionGate>} />
        <Route path="team/view/:id" element={<PermissionGate module="team"><EmployeeProfilePage /></PermissionGate>} />
        
        {/* HR Document Generator */}
        <Route path="hr" element={
          <PermissionGate module="hr">
            <HrDocumentsPage />
          </PermissionGate>
        } />
        <Route path="hr/generate" element={
          <PermissionGate module="hr" minimum="WRITE">
            <GenerateHrDocumentPage />
          </PermissionGate>
        } />
        <Route path="invoices" element={<PermissionGate module="invoices"><InvoicesPage /></PermissionGate>} />
        <Route path="invoices/add" element={<PermissionGate module="invoices" minimum="WRITE"><AddInvoicePage /></PermissionGate>} />
        <Route path="invoices/edit/:id" element={<PermissionGate module="invoices" minimum="WRITE"><EditInvoicePage /></PermissionGate>} />
        <Route path="invoices/view/:id" element={<PermissionGate module="invoices"><InvoiceDetailsPage /></PermissionGate>} />
        <Route path="subscriptions" element={<PermissionGate module="subscriptions"><SubscriptionsPage /></PermissionGate>} />
        <Route path="subscriptions/add" element={<PermissionGate module="subscriptions" minimum="WRITE"><AddSubscriptionPage /></PermissionGate>} />
        <Route path="subscriptions/edit/:id" element={<PermissionGate module="subscriptions" minimum="WRITE"><EditSubscriptionPage /></PermissionGate>} />
        <Route path="subscriptions/view/:id" element={<PermissionGate module="subscriptions"><SubscriptionDetailsPage /></PermissionGate>} />
        <Route path="social-media" element={<PermissionGate module="social_media"><SocialMediaTasksPage /></PermissionGate>} />
        <Route path="social-media/planner" element={<PermissionGate module="social_media"><SocialMediaPlannerPage /></PermissionGate>} />
        <Route path="social-media/analyze" element={<PermissionGate module="social_media"><SocialAnalyzePage /></PermissionGate>} />
        <Route path="social-media/publish" element={<PermissionGate module="social_media"><SocialPublishPage /></PermissionGate>} />
        <Route path="social-media/accounts" element={<PermissionGate module="social_media"><SocialAccountsPage /></PermissionGate>} />
        <Route path="social-media/select-account" element={<PermissionGate module="social_media"><SocialAccountPickerPage /></PermissionGate>} />
        <Route path="social-media/presentation" element={<PermissionGate module="strategy_decks"><SocialStrategyPresentationStudioPage /></PermissionGate>} />
        <Route path="reports/social-performance" element={<PermissionGate module="social_media"><SocialPerformanceReportPage /></PermissionGate>} />
        <Route path="social-media/ad-spend" element={<PermissionGate module="social_media"><SocialAdSpendPage /></PermissionGate>} />
        <Route path="reports/financial" element={<PermissionGate module="financial_reports"><FinancialReportPage /></PermissionGate>} />
        <Route path="expenses" element={<PermissionGate module="expenses"><ExpensesPage /></PermissionGate>} />
        <Route path="calendar" element={<PermissionGate module="calendar"><CalendarPage /></PermissionGate>} />
        <Route path="proforma" element={<PermissionGate module="proforma"><ProformaPage /></PermissionGate>} />
        <Route path="proforma/add" element={<PermissionGate module="proforma" minimum="WRITE"><AddProformaPage /></PermissionGate>} />
        <Route path="proforma/edit/:id" element={<PermissionGate module="proforma" minimum="WRITE"><EditProformaPage /></PermissionGate>} />
        <Route path="proforma/view/:id" element={<PermissionGate module="proforma"><ProformaDetailsPage /></PermissionGate>} />
        <Route path="packages" element={<PermissionGate module="packages"><PackagesPage /></PermissionGate>} />
        <Route path="packages/add" element={<PermissionGate module="packages" minimum="WRITE"><AddPackagePage /></PermissionGate>} />
        <Route path="packages/edit/:id" element={<PermissionGate module="packages" minimum="WRITE"><EditPackagePage /></PermissionGate>} />
        <Route path="packages/view/:id" element={<PermissionGate module="packages"><PackageDetailsPage /></PermissionGate>} />
        <Route path="services" element={<PermissionGate module="services"><ServicesPage /></PermissionGate>} />
        <Route path="services/add" element={<PermissionGate module="services" minimum="WRITE"><AddServicePage /></PermissionGate>} />
        <Route path="services/edit/:id" element={<PermissionGate module="services" minimum="WRITE"><EditServicePage /></PermissionGate>} />
        <Route path="services/view/:id" element={<PermissionGate module="services"><ServiceDetailsPage /></PermissionGate>} />
        <Route path="settings" element={<PermissionGate module="settings"><SettingsPage /></PermissionGate>} />
        <Route path="ai-assistant" element={<PermissionGate module="ai_assistant"><AiAssistantPage /></PermissionGate>} />
        <Route path="settings/landing-page" element={<Navigate to="/dashboard/settings?tab=landing-page" replace />} />
        <Route path="plugins" element={<Navigate to="/dashboard/settings?tab=plugins" replace />} />
        <Route path="transfers" element={<PermissionGate module="transfers"><FileTransfer /></PermissionGate>} />
        <Route path="leads" element={<PermissionGate module="leads"><LeadsPage /></PermissionGate>} />
        <Route path="email" element={<PermissionGate module="email"><EmailCenterPage /></PermissionGate>} />
        <Route path="email/mailboxes" element={<PermissionGate module="email" minimum="MANAGE"><EmailMailboxesPage /></PermissionGate>} />
        <Route path="email/templates" element={<PermissionGate module="email"><EmailTemplatesPage /></PermissionGate>} />
        <Route path="email/analytics" element={<PermissionGate module="email"><EmailAnalyticsPage /></PermissionGate>} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AgencyAppearanceManager />
        <GlobalUploadProgress />
        <Suspense fallback={<LoadingScreen fadeOut={false} />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
