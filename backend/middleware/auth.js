import { supabase, getSupabaseForUser } from "../supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: error?.message || "Invalid access token" });
    }

    req.userId = user.id;
    req.user = user;
    // Attach scoped Supabase client with user credentials for RLS compliance
    req.supabase = getSupabaseForUser(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || "Authentication failed" });
  }
}
