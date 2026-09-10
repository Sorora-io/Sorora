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
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import EnterBigs from "./pages/admin/EnterBigs";
import EnterLittles from "./pages/admin/EnterLittles";
import Twins from "./pages/admin/Twins";
import RankingRequirements from "./pages/admin/RankingRequirements";
import RankPreferences from "./pages/admin/RankPreferences";
import RankBigs from "./pages/admin/RankBigs";
import ReviewSummary from "./pages/admin/ReviewSummary";
import Pairings from "./pages/admin/Pairings";
import GroupOnboarding from "./pages/group/Onboarding";
import GroupPending from "./pages/group/Pending";
import GroupApprovals from "./pages/group/Approvals";
import GroupSettings from "./pages/group/Settings";
import GroupSubmitRanking from "./pages/group/SubmitRanking";
import GroupStatus from "./pages/group/Status";
import GroupPairings from "./pages/group/Pairings";
import GroupRoster from "./pages/group/Roster";
import GroupNotes from "./pages/group/Notes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/dashboard" element={<RequireRealAccount><Dashboard /></RequireRealAccount>} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
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
              <AppShell />
            </BrowserRouter>
          </MatchingProvider>
        </GroupProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
