import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import DireksiDashboard from "@/pages/DireksiDashboard";
import InputPage from "@/pages/InputPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setBaseUrl } from "@workspace/api-client-react";

// Point API calls to the Railway backend when VITE_API_URL is set.
// Falls back to "" (relative /api) for local dev via Vite proxy.
const apiUrl = import.meta.env.VITE_API_URL ?? "";
setBaseUrl(apiUrl || null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Don't crash the UI on network errors – show empty state instead
      throwOnError: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={DireksiDashboard} />
      <Route path="/input" component={InputPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // BASE_URL is '/' on Vercel — stripping it produces '' which breaks routing.
  // Use empty string as base only when BASE_URL is exactly '/'.
  const base = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster theme="dark" />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
