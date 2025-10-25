import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MatchingProvider } from "./contexts/MatchingContext";
import Index from "./pages/Index";
import Mission from "./pages/Mission";
import HowItWorks from "./pages/HowItWorks";
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
      <MatchingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mission" element={<Mission />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/why-it-works" element={<WhyItWorks />} />
            <Route path="/admin/enter-bigs" element={<EnterBigs />} />
            <Route path="/admin/enter-littles" element={<EnterLittles />} />
            <Route path="/admin/twins" element={<Twins />} />
            <Route path="/admin/ranking-requirements" element={<RankingRequirements />} />
            <Route path="/admin/rank-preferences" element={<RankPreferences />} />
            <Route path="/admin/rank-bigs" element={<RankBigs />} />
            <Route path="/admin/review-summary" element={<ReviewSummary />} />
            <Route path="/admin/pairings" element={<Pairings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </MatchingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
