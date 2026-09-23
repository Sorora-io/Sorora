import { Suspense, lazy } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GroupProvider, useGroup } from "./contexts/GroupContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRealAccount from "./components/RequireRealAccount";
import RequireGroupRole from "./components/RequireGroupRole";
import LoadingScreen from "./components/LoadingScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
// Index and Login stay eager — they're the two pages a fresh visitor is
// actually likely to land on first, so loading them shouldn't cost an
// extra chunk-fetch round trip. Everything else (chapter-scoped pages a
// visitor needs a real membership to ever reach, account settings) is
// lazy — a first-time visitor pays for none of that code until they
// navigate somewhere that needs it.
import Index from "./pages/Index";
import Login from "./pages/Login";

const Superuser = lazy(() => import("./pages/Superuser"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const GroupOnboarding = lazy(() => import("./pages/group/Onboarding"));
const GroupPending = lazy(() => import("./pages/group/Pending"));
const GroupApprovals = lazy(() => import("./pages/group/Approvals"));
const GroupSettings = lazy(() => import("./pages/group/Settings"));
const GroupSubmitRanking = lazy(() => import("./pages/group/SubmitRanking"));
const GroupStatus = lazy(() => import("./pages/group/Status"));
const GroupPairings = lazy(() => import("./pages/group/Pairings"));
const GroupRoster = lazy(() => import("./pages/group/Roster"));
const NotFound = lazy(() => import("./pages/NotFound"));

// A page that fetches its own data on every mount (the old pattern here)
// re-shows a loading state every time you navigate back to it, even
// seconds after you left — nothing has actually changed. staleTime keeps
// cached data "fresh" for a while so revisiting a page renders instantly
// from cache instead of blocking on a refetch; gcTime keeps it around a
// bit longer than that so a quick back-and-forth between pages doesn't
// even trigger a network request.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Keep public auth forms mounted while membership loading follows a sign-in.
// Protected routes wait for the current account’s memberships themselves.
const AppShell = () => {
  const { loading: authLoading, user } = useAuth();
  const { error: groupError, refresh, loading: groupLoading } = useGroup();

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {user && groupError && (
        <div role="alert" className="mx-auto my-4 max-w-2xl rounded-xl border border-brick p-4 text-sm">
          <p>We couldn’t finish loading your chapter: {groupError}</p>
          <button type="button" className="mt-2 underline" onClick={() => void refresh()} disabled={groupLoading}>
            {groupLoading ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      )}
      <main className="flex-1 flex flex-col">
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/superuser" element={<Superuser />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<RequireRealAccount><Dashboard /></RequireRealAccount>} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/group/onboarding" element={<RequireRealAccount><GroupOnboarding /></RequireRealAccount>} />
          <Route path="/group/pending" element={<RequireRealAccount><GroupPending /></RequireRealAccount>} />
          <Route path="/group/approvals" element={<RequireGroupRole allow={['admin']}><GroupApprovals /></RequireGroupRole>} />
          <Route path="/group/settings" element={<RequireGroupRole allow={['admin']}><GroupSettings /></RequireGroupRole>} />
          <Route path="/group/status" element={<RequireGroupRole allow={['admin']}><GroupStatus /></RequireGroupRole>} />
          <Route path="/group/pairings" element={<RequireGroupRole allow={['admin']}><GroupPairings /></RequireGroupRole>} />
          <Route path="/group/submit-ranking" element={<RequireGroupRole allow={['admin', 'big', 'little']}><GroupSubmitRanking /></RequireGroupRole>} />
          <Route path="/group/roster" element={<RequireGroupRole allow={['admin', 'big', 'little']}><GroupRoster /></RequireGroupRole>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </main>
      <Footer />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <GroupProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppShell />
            </ErrorBoundary>
          </BrowserRouter>
        </GroupProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
