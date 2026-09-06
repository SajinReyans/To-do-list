import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const { signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth();

  const handleGoogleAuth = async () => {
    setError("");
    setMessage("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Google authentication failed");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const data = await signUp(email.trim(), password);
        if (data?.user && !data.session) {
          setMessage("Account created! If email verification is required, please check your inbox.");
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: "var(--bg)" }}>
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl animate-levitate shadow-lg"
            style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)" }}
          />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Aloft
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-soft)" }}>
              Tasks that float, goals that branch.
            </p>
          </div>
        </div>

        <div
          className="rounded-3xl p-7 shadow-xl border-2 backdrop-blur-sm"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Direct Google OAuth Sign-in / Sign-up Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 rounded-2xl font-semibold border-2 flex items-center justify-center gap-3 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <GoogleIcon />
            <span>{googleLoading ? "Connecting to Google…" : isSignUp ? "Sign up with Google" : "Continue with Google"}</span>
          </button>

          {/* Guest Demo Mode */}
          <button
            type="button"
            onClick={signInAsGuest}
            className="w-full mt-2.5 py-2.5 px-4 rounded-2xl text-xs font-semibold border-2 flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5 active:scale-95 cursor-pointer shadow-sm"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <span>⚡ Continue as Guest (Instant Access)</span>
          </button>

          <div className="relative my-5 text-center">

            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
            </div>
            <span
              className="relative px-3 text-xs font-semibold uppercase rounded-full"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-soft)" }}
            >
              or with email
            </span>
          </div>

          <div
            className="flex rounded-xl p-1 mb-6 border-2"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
          >
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError("");
                setMessage("");
              }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              style={{
                backgroundColor: !isSignUp ? "var(--accent)" : "transparent",
                color: !isSignUp ? "#fff" : "var(--text)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError("");
                setMessage("");
              }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              style={{
                backgroundColor: isSignUp ? "var(--accent)" : "transparent",
                color: isSignUp ? "#fff" : "var(--text)",
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--text-soft)" }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-xl px-4 py-2.5 border-2 bg-white/80 outline-none transition focus:ring-2"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: "var(--text-soft)" }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-2.5 border-2 bg-white/80 outline-none transition focus:ring-2"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>

            {error && (
              <div
                className="text-xs p-3 rounded-xl border font-medium"
                style={{ backgroundColor: "#ff000012", borderColor: "#ff000030", color: "#c81e33" }}
              >
                {error}
              </div>
            )}

            {message && (
              <div
                className="text-xs p-3 rounded-xl border font-medium text-emerald-800 bg-emerald-50 border-emerald-200"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 rounded-xl font-semibold text-white mt-2 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {loading ? "Please wait…" : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs" style={{ color: "var(--text-soft)" }}>
          Protected by Supabase Authentication & Row Level Security
        </p>
      </div>
    </div>
  );
}
