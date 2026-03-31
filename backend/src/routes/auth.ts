import { Router } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { supabase } from "../supabase";

const router = Router();

/**
 * GET /auth/me — return the current user's profile
 */
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", req.userId!)
    .single();

  if (error) {
    return res.status(404).json({ error: "Profile not found" });
  }

  res.json(data);
});

export default router;
