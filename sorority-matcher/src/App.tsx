import { Suspense, lazy } from "react";
import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MatchingProvider } from "./contexts/MatchingContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { GroupProvider, useGroup } from "./contexts/GroupContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRealAccount from "./components/RequireRealAccount";
import RequireGroupRole from "./components/RequireGroupRole";
import SidePanel from "./components/SidePanel";
import LoadingScreen from "./components/LoadingScreen";
import ErrorBoundary from "./components/ErrorBoundary";
// Index and Login stay eager — they're the two pages a fresh visitor is
// actually likely to land on first, so loading them shouldn't cost an
// extra chunk-fetch round trip. Everything else (chapter-scoped pages a
// visitor needs a real membership to ever reach, the guest-only quick
// -match wizard, account settings) is lazy — a first-time visitor pays
// for none of that code until they navigate somewhere that needs it.
import Index from "./pages/Index";
import Login from "./pages/Login";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const EnterBigs = lazy(() => import("./pages/admin/EnterBigs"));
const EnterLittles = lazy(() => import("./pages/admin/EnterLittles"));
const Twins = lazy(() => import("./pages/admin/Twins"));
const RankingRequirements = lazy(() => import("./pages/admin/RankingRequirements"));
const RankPreferences = lazy(() => import("./pages/admin/RankPreferences"));
const RankBigs = lazy(() => import("./pages/admin/RankBigs"));
const ReviewSummary = lazy(() => import("./pages/admin/ReviewSummary"));
const Pairings = lazy(() => import("./pages/admin/Pairings"));
const GroupOnboarding = lazy(() => import("./pages/group/Onboarding"));
const GroupPending = lazy(() => import("./pages/group/Pending"));
const GroupApprovals = lazy(() => import("./pages/group/Approvals"));
const GroupSettings = lazy(() => import("./pages/group/Settings"));
const GroupSubmitRanking = lazy(() => import("./pages/group/SubmitRanking"));
const GroupStatus = lazy(() => import("./pages/group/Status"));
const GroupPairings = lazy(() => import("./pages/group/Pairings"));
const GroupRoster = lazy(() => import("./pages/group/Roster"));
const GroupNotes = lazy(() => import("./pages/group/Notes"));
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

// Session restore on a fresh page load/reload is the one moment the whole
// app is in an unknown auth AND organization state — gating the entire
// shell (not just each route's own content area) on both avoids a
// signed-in sidebar/content flashing signed-out chrome, or a real member
// briefly flashing "no organizations," before AuthContext and GroupContext
// resolve. `groupInitialized` (not GroupContext's `loading`) is the right
// flag here — it only ever flips false->true once, on the first membership
// fetch, so a later refresh() (e.g. after saving something) doesn't bounce
// the whole app back to this full-page spinner.
const AppShell = () => {
  const { loading: authLoading } = useAuth();
  const { initialized: groupInitialized } = useGroup();

  if (authLoading || !groupInitialized) {
    return <LoadingScreen />;
  }

  return (
    <div className="md:flex">
      <SidePanel />
      <div className="flex-1 min-w-0">
        <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<RequireRealAccount><Dashboard /></RequireRealAccount>} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/admin/enter-bigs" element={<ProtectedRoute><EnterBigs /></ProtectedRoute>} />
          <Route path="/admin/enter-littles" element={<ProtectedRoute><EnterLittles /></ProtectedRoute>} />
          <Route path="/admin/twins" element={<ProtectedRoute><Twins /></ProtectedRoute>} />
          <Route path="/admin/ranking-requirements" element={<ProtectedRoute><RankingRequirements /></ProtectedRoute>} />
          <Route path="/admin/rank-preferences" element={<ProtectedRoute><RankPreferences /></ProtectedRoute>} />
          <Route path="/admin/rank-bigs" element={<ProtectedRoute><RankBigs /></ProtectedRoute>} />
          <Route path="/admin/review-summary" element={<ProtectedRoute><ReviewSummary /></ProtectedRoute>} />
          <Route path="/admin/pairings" element={<ProtectedRoute><Pairings /></ProtectedRoute>} />
          <Route path="/group/onboarding" element={<RequireRealAccount><GroupOnboarding /></RequireRealAccount>} />
          <Route path="/group/pending" element={<RequireRealAccount><GroupPending /></RequireRealAccount>} />
          <Route path="/group/approvals" element={<RequireGroupRole allow={['admin']}><GroupApprovals /></RequireGroupRole>} />
          <Route path="/group/settings" element={<RequireGroupRole allow={['admin']}><GroupSettings /></RequireGroupRole>} />
          <Route path="/group/status" element={<RequireGroupRole allow={['admin']}><GroupStatus /></RequireGroupRole>} />
          <Route path="/group/pairings" element={<RequireGroupRole allow={['admin']}><GroupPairings /></RequireGroupRole>} />
          <Route path="/group/submit-ranking" element={<RequireGroupRole allow={['big', 'little']}><GroupSubmitRanking /></RequireGroupRole>} />
          <Route path="/group/roster" element={<RequireGroupRole allow={['admin', 'big', 'little']}><GroupRoster /></RequireGroupRole>} />
          <Route path="/group/notes" element={<RequireGroupRole allow={['big', 'little']}><GroupNotes /></RequireGroupRole>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>
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
          <MatchingProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AppShell />
              </ErrorBoundary>
            </BrowserRouter>
          </MatchingProvider>
        </GroupProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
