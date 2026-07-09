import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuthStore } from "@/lib/auth-store";

import NotFound from "./pages/NotFound.tsx";
import AdminLoginPage from "./pages/AdminLoginPage.tsx";
import ClientLoginPage from "./pages/ClientLoginPage.tsx";
import ClientPortalPage from "./pages/ClientPortalPage.tsx";
import DashboardLayout from "./components/DashboardLayout.tsx";
import { AgencyAppearanceManager } from "./components/AgencyAppearanceManager.tsx";
import { GlobalUploadProgress } from "./components/GlobalUploadProgress.tsx";
import DashboardOverview from "./pages/DashboardOverview.tsx";
import ClientsPage from "./pages/ClientsPage.tsx";
import AddClientPage from "./pages/AddClientPage.tsx";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import AddProjectPage from "./pages/AddProjectPage.tsx";
import TeamPage from "./pages/TeamPage.tsx";
import AddEmployeePage from "./pages/AddEmployeePage.tsx";
import EmployeeProfilePage from "./pages/EmployeeProfilePage.tsx";
import InvoicesPage from "./pages/InvoicesPage.tsx";
import AddInvoicePage from "./pages/AddInvoicePage.tsx";
import SubscriptionsPage from "./pages/SubscriptionsPage.tsx";
import AddSubscriptionPage from "./pages/AddSubscriptionPage.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import EditClientPage from "./pages/EditClientPage.tsx";
import EditProjectPage from "./pages/EditProjectPage.tsx";
// EditTeamMemberPage replaced by AddEmployeePage in edit mode
import EditInvoicePage from "./pages/EditInvoicePage.tsx";
import EditSubscriptionPage from "./pages/EditSubscriptionPage.tsx";
import ProformaPage from "./pages/ProformaPage.tsx";
import PackagesPage from "./pages/PackagesPage.tsx";
import ServicesPage from "./pages/ServicesPage.tsx";
import AddProformaPage from "./pages/AddProformaPage.tsx";
import EditProformaPage from "./pages/EditProformaPage.tsx";
import AddPackagePage from "./pages/AddPackagePage.tsx";
import EditPackagePage from "./pages/EditPackagePage.tsx";
import AddServicePage from "./pages/AddServicePage.tsx";
import EditServicePage from "./pages/EditServicePage.tsx";
import ClientDetailsPage from "./pages/ClientDetailsPage.tsx";
import ProjectDetailsPage from "./pages/ProjectDetailsPage.tsx";
// TeamMemberDetailsPage replaced by EmployeeProfilePage
import InvoiceDetailsPage from "./pages/InvoiceDetailsPage.tsx";
import ProformaDetailsPage from "./pages/ProformaDetailsPage.tsx";
import SubscriptionDetailsPage from "./pages/SubscriptionDetailsPage.tsx";
import PackageDetailsPage from "./pages/PackageDetailsPage.tsx";
import ServiceDetailsPage from "./pages/ServiceDetailsPage.tsx";
import LeadsPage from "./pages/LeadsPage.tsx";
import VerifyDocumentPage from "./pages/VerifyDocumentPage.tsx";
import UsersPage from './pages/UsersPage.tsx';
import AddUserPage from './pages/AddUserPage.tsx';
import SocialMediaTasksPage from './pages/SocialMediaTasksPage.tsx';
import SocialMediaPlannerPage from './pages/SocialMediaPlannerPage.tsx';
import MonthlyReportStudioPage from "./pages/MonthlyReportStudioPage.tsx";
import FinancialReportPage from "./pages/FinancialReportPage.tsx";
import ExpensesPage from "./pages/ExpensesPage.tsx";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

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
      <Route path="/verify/:token" element={<VerifyDocumentPage />} />

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
        <Route path="users" element={
          <ProtectedRoute allowedRoles="admin">
            <UsersPage />
          </ProtectedRoute>
        } />
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
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
