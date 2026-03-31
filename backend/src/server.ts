import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import { requireAuth, AuthRequest } from "./middleware/auth";
import { supabase } from "./supabase";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

app.use("/auth", authRoutes);

/**
 * POST /results — save a matching result for the logged-in user
 */
app.post("/results", requireAuth, async (req: AuthRequest, res) => {
  const { bigs, littles, pairings } = req.body;

  const { data, error } = await supabase
    .from("matching_results")
    .insert({
      user_id: req.userId!,
      bigs,
      littles,
      pairings,
    })
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json(data);
});

/**
 * GET /results — get all matching results for the logged-in user
 */
app.get("/results", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("matching_results")
    .select("*")
    .eq("user_id", req.userId!)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
