import { Switch, Route, useParams, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import PropertyView from "@/pages/property-view";
import PropertyExplorer from "@/pages/property-explorer";
import WeatherDashboard from "@/pages/weather-dashboard";
import BatchManagement from "@/pages/batch-management";
import UnassignedPhotos from "@/pages/unassigned-photos";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { TemplateManager } from "@/pages/template-manager";
import UserManagement from "@/pages/user-management";
import { PhotoEditorPage } from "@/pages/photo-editor-page";
import InspectionPage from "@/pages/inspection-page";
import { SharedPropertyView } from "@/pages/shared-property-view";
import { SharedReportPage } from "@/pages/shared-report-page";
import React from 'react';

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: { 
  component: React.ComponentType<any>;
  adminOnly?: boolean;
  [key: string]: any;
}) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (adminOnly && user.role !== "admin") {
    return <NotFound />;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/property-explorer" component={() => <ProtectedRoute component={PropertyExplorer} />} />
      <Route path="/property/:id" component={() => <ProtectedRoute component={PropertyView} />} />
      <Route path="/property/:id/photos/:photoId/edit" component={() => <ProtectedRoute component={PhotoEditorPage} />} />
      <Route path="/property/:id/inspection/new" component={() => <ProtectedRoute component={InspectionPage} />} />
      <Route path="/weather" component={() => <ProtectedRoute component={WeatherDashboard} />} />
      <Route path="/batch-management" component={() => <ProtectedRoute component={BatchManagement} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UserManagement} adminOnly />} />
      <Route path="/unassigned-photos" component={() => <ProtectedRoute component={UnassignedPhotos} />} />
      <Route path="/templates" component={() => <ProtectedRoute component={TemplateManager} adminOnly />} />

      {/* Public report routes - no authentication required */}
      <Route path="/share/:token" component={SharedPropertyView} />
      <Route path="/reports/share/:shareToken" component={SharedReportPage} />
      <Route path="/public/report/:shareToken" component={() => {
        const { shareToken } = useParams();
        const [, navigate] = useLocation();
        React.useEffect(() => {
          navigate(`/reports/share/${shareToken}`);
        }, [shareToken, navigate]);
        return null;
      }} />
      <Route path="/report/share/:shareToken" component={SharedReportPage} />

      {/* 404 route - must be last */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" attribute="class">
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;