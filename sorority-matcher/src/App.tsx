import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MatchingProvider } from "./contexts/MatchingContext";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Mission from "./pages/Mission";
import HowItWorks from "./pages/HowItWorks";
import Step1 from "./pages/how-it-works/Step1";
import Step2 from "./pages/how-it-works/Step2";
import HowItWorksTwins from "./pages/how-it-works/Twins";
import WhyItWorks from "./pages/WhyItWorks";
import EnterBigs from "./pages/admin/EnterBigs";
import EnterLittles from "./pages/admin/EnterLittles";
import Twins from "./pages/admin/Twins";
import RankingRequirements from "./pages/admin/RankingRequirements";
import RankPreferences from "./pages/admin/RankPreferences";
import RankBigs from "./pages/admin/RankBigs";
import ReviewSummary from "./pages/admin/ReviewSummary";
import Pairings from "./pages/admin/Pairings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <MatchingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/mission" element={<Mission />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/how-it-works/step-1" element={<Step1 />} />
              <Route path="/how-it-works/step-2" element={<Step2 />} />
              <Route path="/how-it-works/twins" element={<HowItWorksTwins />} />
              <Route path="/why-it-works" element={<WhyItWorks />} />
              <Route path="/admin/enter-bigs" element={<ProtectedRoute><EnterBigs /></ProtectedRoute>} />
              <Route path="/admin/enter-littles" element={<ProtectedRoute><EnterLittles /></ProtectedRoute>} />
              <Route path="/admin/twins" element={<ProtectedRoute><Twins /></ProtectedRoute>} />
              <Route path="/admin/ranking-requirements" element={<ProtectedRoute><RankingRequirements /></ProtectedRoute>} />
              <Route path="/admin/rank-preferences" element={<ProtectedRoute><RankPreferences /></ProtectedRoute>} />
              <Route path="/admin/rank-bigs" element={<ProtectedRoute><RankBigs /></ProtectedRoute>} />
              <Route path="/admin/review-summary" element={<ProtectedRoute><ReviewSummary /></ProtectedRoute>} />
              <Route path="/admin/pairings" element={<ProtectedRoute><Pairings /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </MatchingProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
