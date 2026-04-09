import { Router } from "express";
import type { Request, Response } from "express";
import { getSupabaseClient } from "../lib/supabase.js";

export const authRouter = Router();

authRouter.get("/me", async (req: Request, res: Response) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(503).json({ error: "Auth not configured" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.slice(7);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    avatar: user.user_metadata?.avatar_url,
  });
});
