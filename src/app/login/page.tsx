"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2 } from "lucide-react";

const MAGIC_LINK_EMAIL_KEY = "emailForSignIn";

type EmailTab = "password" | "magic";

function cleanFirebaseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Authentication failed";
  return msg.replace("Firebase: ", "").replace(/ \(auth\/.*\)\.?$/, "");
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [emailTab, setEmailTab] = useState<EmailTab>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  // When returning from a magic link, we may need to prompt for email
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  // Already signed in — hard redirect so the server re-renders the layout
  // with the new __uid cookie (soft nav reuses the cached layout and misses it).
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = "/";
    }
  }, [user, authLoading, router]);

  // Complete magic-link sign-in when returning from email
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const saved = localStorage.getItem(MAGIC_LINK_EMAIL_KEY);
    if (saved) {
      setLoading(true);
      signInWithEmailLink(auth, saved, window.location.href)
        .then(() => {
          localStorage.removeItem(MAGIC_LINK_EMAIL_KEY);
          // AuthContext onAuthStateChanged will redirect to /
        })
        .catch((err) => {
          setError(cleanFirebaseError(err));
          setLoading(false);
        });
    } else {
      // Link opened on a different device — ask for email
      setEmailTab("magic");
      setNeedsEmailConfirm(true);
    }
  }, []);

  const handleConfirmEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmEmail.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailLink(
        auth,
        confirmEmail.trim(),
        window.location.href,
      );
      localStorage.removeItem(MAGIC_LINK_EMAIL_KEY);
    } catch (err) {
      setError(cleanFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(cleanFirebaseError(err));
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(cleanFirebaseError(err));
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      localStorage.setItem(MAGIC_LINK_EMAIL_KEY, email.trim());
      setMagicSent(true);
    } catch (err) {
      setError(cleanFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ─── Returning from magic link on different device ─────────────────────────
  if (needsEmailConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Voice Call AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Confirm your email to finish signing in
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <form onSubmit={handleConfirmEmail} className="space-y-3">
              <div>
                <label
                  htmlFor="confirm-email"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Your email address
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@company.com"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Complete sign-in"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Magic link sent confirmation ─────────────────────────────────────────
  if (magicSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="size-7 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Check your inbox
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click it to sign in — no password needed.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t get it?{" "}
              <button
                onClick={() => {
                  setMagicSent(false);
                  setError(null);
                }}
                className="text-primary hover:underline font-medium"
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main login form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Voice Call AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {emailTab === "password" && isSignUp
              ? "Create your account"
              : "Sign in to your account"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {/* Google */}
          <button
            onClick={() => void handleGoogle()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 h-10 px-4 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
            <button
              onClick={() => {
                setEmailTab("magic");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium transition-colors ${
                emailTab === "magic"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="size-3.5" />
              Magic link
            </button>
            <button
              onClick={() => {
                setEmailTab("password");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center h-8 rounded-md text-xs font-medium transition-colors ${
                emailTab === "password"
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
          </div>

          {/* Magic link form */}
          {emailTab === "magic" && (
            <form
              onSubmit={(e) => void handleMagicLink(e)}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="magic-email"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Email
                </label>
                <input
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@company.com"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send magic link"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                We&apos;ll email you a link — no password required.
              </p>
            </form>
          )}

          {/* Password form */}
          {emailTab === "password" && (
            <form
              onSubmit={(e) => void handlePasswordAuth(e)}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="pw-email"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Email
                </label>
                <input
                  id="pw-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label
                  htmlFor="pw-password"
                  className="block text-xs font-medium text-foreground mb-1"
                >
                  Password
                </label>
                <input
                  id="pw-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
          )}
        </div>

        {emailTab === "password" && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => {
                setIsSignUp((v) => !v);
                setError(null);
              }}
              className="text-primary hover:underline font-medium"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
