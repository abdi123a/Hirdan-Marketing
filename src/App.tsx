import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
const MonthlyReportStudioPage = lazy(() => import("./pages/MonthlyReportStudioPage.tsx"));
const FinancialReportPage = lazy(() => import("./pages/FinancialReportPage.tsx"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage.tsx"));
const HrDocumentsPage = lazy(() => import("@/pages/HrDocumentsPage.tsx"));
const GenerateHrDocumentPage = lazy(() => import("@/pages/GenerateHrDocumentPage.tsx"));
const FileTransfer = lazy(() => import("./pages/FileTransfer.tsx"));
const LandingPageEditor = lazy(() => import("./pages/LandingPageEditor.tsx"));
const PluginsPage = lazy(() => import("./pages/PluginsPage.tsx"));

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
          // Normalize role to lowercase for the store
          const normalizedUser = {
            role: authData.user.role.toLowerCase() as any,
            email: authData.user.email,
            name: authData.user.name,
            ...(authData.user.client ? {
              company: authData.user.client.company,
              clientId: authData.user.client.id,
            } : {})
          };
          
          useAuthStore.setState({
            user: normalizedUser,
            isAuthenticated: true
          });
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

      {/* Admin dashboard (protected - admin role) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles="admin">
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/add" element={<AddClientPage />} />
        <Route path="clients/edit/:id" element={<EditClientPage />} />
        <Route path="clients/view/:id" element={<ClientDetailsPage />} />

        {/* User Management */}
        <Route path="users" element={<Navigate to="/dashboard/settings?tab=users" replace />} />
        <Route path="users/add" element={
          <ProtectedRoute allowedRoles="admin">
            <AddUserPage />
          </ProtectedRoute>
        } />
        <Route path="users/edit/:id" element={
          <ProtectedRoute allowedRoles="admin">
            <AddUserPage />
          </ProtectedRoute>
        } />

        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/add" element={<AddProjectPage />} />
        <Route path="projects/edit/:id" element={<EditProjectPage />} />
        <Route path="projects/view/:id" element={<ProjectDetailsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team/add" element={<AddEmployeePage />} />
        <Route path="team/edit/:id" element={<AddEmployeePage />} />
        <Route path="team/view/:id" element={<EmployeeProfilePage />} />
        
        {/* HR Document Generator */}
        <Route path="hr" element={
          <ProtectedRoute allowedRoles={["admin", "manager"]}>
            <HrDocumentsPage />
          </ProtectedRoute>
        } />
        <Route path="hr/generate" element={
          <ProtectedRoute allowedRoles={["admin", "manager"]}>
            <GenerateHrDocumentPage />
          </ProtectedRoute>
        } />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/add" element={<AddInvoicePage />} />
        <Route path="invoices/edit/:id" element={<EditInvoicePage />} />
        <Route path="invoices/view/:id" element={<InvoiceDetailsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/add" element={<AddSubscriptionPage />} />
        <Route path="subscriptions/edit/:id" element={<EditSubscriptionPage />} />
        <Route path="subscriptions/view/:id" element={<SubscriptionDetailsPage />} />
        <Route path="social-media" element={<SocialMediaTasksPage />} />
        <Route path="social-media/planner" element={<SocialMediaPlannerPage />} />
        <Route path="reports/monthly" element={<MonthlyReportStudioPage />} />
        <Route path="reports/financial" element={<FinancialReportPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="proforma" element={<ProformaPage />} />
        <Route path="proforma/add" element={<AddProformaPage />} />
        <Route path="proforma/edit/:id" element={<EditProformaPage />} />
        <Route path="proforma/view/:id" element={<ProformaDetailsPage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="packages/add" element={<AddPackagePage />} />
        <Route path="packages/edit/:id" element={<EditPackagePage />} />
        <Route path="packages/view/:id" element={<PackageDetailsPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/add" element={<AddServicePage />} />
        <Route path="services/edit/:id" element={<EditServicePage />} />
        <Route path="services/view/:id" element={<ServiceDetailsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="ai-assistant" element={<AiAssistantPage />} />
        <Route path="settings/landing-page" element={<Navigate to="/dashboard/settings?tab=landing-page" replace />} />
        <Route path="plugins" element={<Navigate to="/dashboard/settings?tab=plugins" replace />} />
        <Route path="transfers" element={<FileTransfer />} />
        <Route path="leads" element={<LeadsPage />} />
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
