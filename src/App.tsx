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
import DashboardOverview from "./pages/DashboardOverview.tsx";
import ClientsPage from "./pages/ClientsPage.tsx";
import AddClientPage from "./pages/AddClientPage.tsx";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import AddProjectPage from "./pages/AddProjectPage.tsx";
import TeamPage from "./pages/TeamPage.tsx";
import AddTeamMemberPage from "./pages/AddTeamMemberPage.tsx";
import InvoicesPage from "./pages/InvoicesPage.tsx";
import AddInvoicePage from "./pages/AddInvoicePage.tsx";
import SubscriptionsPage from "./pages/SubscriptionsPage.tsx";
import AddSubscriptionPage from "./pages/AddSubscriptionPage.tsx";
import CalendarPage from "./pages/CalendarPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import EditClientPage from "./pages/EditClientPage.tsx";
import EditProjectPage from "./pages/EditProjectPage.tsx";
import EditTeamMemberPage from "./pages/EditTeamMemberPage.tsx";
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
import TeamMemberDetailsPage from "./pages/TeamMemberDetailsPage.tsx";
import InvoiceDetailsPage from "./pages/InvoiceDetailsPage.tsx";
import ProformaDetailsPage from "./pages/ProformaDetailsPage.tsx";
import SubscriptionDetailsPage from "./pages/SubscriptionDetailsPage.tsx";
import PackageDetailsPage from "./pages/PackageDetailsPage.tsx";
import ServiceDetailsPage from "./pages/ServiceDetailsPage.tsx";
import LeadsPage from "./pages/LeadsPage.tsx";
import VerifyDocumentPage from "./pages/VerifyDocumentPage.tsx";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const [isVerifying, setIsVerifying] = useState(true);
  const { user, isAuthenticated, logout, setToken } = useAuthStore();

  useEffect(() => {
    const verifyAuth = async () => {
      // If we seem to be authenticated, verify with the backend
      try {
        const data = await apiFetch<{ user: any }>('/auth/me');
        if (data.user) {
          // Normalize role to lowercase for the store
          const normalizedUser = {
            role: data.user.role.toLowerCase() as any,
            email: data.user.email,
            name: data.user.name,
            ...(data.user.client ? {
              company: data.user.client.company,
              clientId: data.user.client.id,
            } : {})
          };
          
          useAuthStore.setState({
            user: normalizedUser,
            isAuthenticated: true
          });
        } else {
          logout();
        }
      } catch (err) {
        logout();
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAuth();
  }, []);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
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
          <ProtectedRoute allowedRole="client">
            <ClientPortalPage />
          </ProtectedRoute>
        }
      />

      {/* Admin dashboard (protected - admin role) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="admin">
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/add" element={<AddClientPage />} />
        <Route path="clients/edit/:id" element={<EditClientPage />} />
        <Route path="clients/view/:id" element={<ClientDetailsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/add" element={<AddProjectPage />} />
        <Route path="projects/edit/:id" element={<EditProjectPage />} />
        <Route path="projects/view/:id" element={<ProjectDetailsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="team/add" element={<AddTeamMemberPage />} />
        <Route path="team/edit/:id" element={<EditTeamMemberPage />} />
        <Route path="team/view/:id" element={<TeamMemberDetailsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/add" element={<AddInvoicePage />} />
        <Route path="invoices/edit/:id" element={<EditInvoicePage />} />
        <Route path="invoices/view/:id" element={<InvoiceDetailsPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/add" element={<AddSubscriptionPage />} />
        <Route path="subscriptions/edit/:id" element={<EditSubscriptionPage />} />
        <Route path="subscriptions/view/:id" element={<SubscriptionDetailsPage />} />
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
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
