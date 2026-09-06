import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if previously logged in as guest
    if (localStorage.getItem("aloft_guest_session") === "true") {
      const guestUser = {
        id: "00000000-0000-0000-0000-000000000001",
        email: "guest@aloft.local",
      };
      setSession({ access_token: "mock-guest-token", user: guestUser });
      setUser(guestUser);
      setLoading(false);
      return;
    }

    // 1. Fetch initial session on load
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error("Error retrieving Supabase session:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signInAsGuest = useCallback(() => {
    const guestUser = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "guest@aloft.local",
    };
    localStorage.setItem("aloft_guest_session", "true");
    setSession({ access_token: "mock-guest-token", user: guestUser });
    setUser(guestUser);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("aloft_guest_session");
    setSession(null);
    setUser(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore if supabase is not connected
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInAsGuest,
        signOut,
      }}
    >

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
