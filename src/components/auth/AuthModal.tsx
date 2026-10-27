import React, { useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  KeyRound,
  ShieldCheck,
  Send,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Notice } from "../../types";

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  notify?: (title: string, detail?: string, kind?: Notice["kind"]) => void;
  initialMode?: "signin" | "signup" | "magic";
}

export function AuthModal({
  isOpen = true,
  onClose,
  notify,
  initialMode = "signin",
}: AuthModalProps) {
  if (!isOpen) return null;

  const [mode, setMode] = useState<"signin" | "signup" | "magic" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google OAuth 2.0 Sign In
  const handleGoogleSignIn = async () => {
    try {
      setBusy(true);
      setErrorMessage(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message || "Failed to initiate Google authentication.";
      setErrorMessage(msg);
      notify?.("Google Sign-In Error", msg, "error");
    }
  };

  // Email + Password Sign In
  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      setBusy(true);
      setErrorMessage(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) throw error;

      if (data.user) {
        notify?.("Welcome Back!", `Signed in as ${data.user.email}`, "success");
        onClose();
      }
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message || "Invalid email or password.";
      setErrorMessage(msg);
      notify?.("Sign In Failed", msg, "error");
    }
  };

  // Create Account (Sign Up + Supabase Profile Sync)
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!cleanEmail || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setBusy(true);
      setErrorMessage(null);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: displayName.trim() || cleanUsername || "OmnPlay Creator",
            username: cleanUsername || `user_${Date.now().toString().slice(-6)}`,
          },
        },
      });

      if (error) throw error;

      // Ensure profile row exists in Supabase profiles table
      if (data.user) {
        try {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            username: cleanUsername || `creator_${Date.now().toString().slice(-6)}`,
            display_name: displayName.trim() || "OmnPlay Creator",
            avatar_url: `https://api.dicebear.com/7.x/shapes/svg?seed=${cleanEmail}`,
            created_at: new Date().toISOString(),
          });
        } catch {
          // Non-fatal if trigger handles profile creation
        }
      }

      setBusy(false);
      setSuccessMessage("Account created successfully! Check your email to verify your address.");
      notify?.("Account Created!", "Welcome to OmniTube. Your creator profile is ready.", "success");
      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message || "Failed to create account.";
      setErrorMessage(msg);
      notify?.("Sign Up Failed", msg, "error");
    }
  };

  // Passwordless Magic Link Sign In
  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    try {
      setBusy(true);
      setErrorMessage(null);
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      setBusy(false);
      setSuccessMessage("Secure magic link sent! Check your inbox to sign in instantly.");
      notify?.("Check Your Inbox", "A secure sign-in magic link is on its way.", "success");
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message || "Failed to send magic link.";
      setErrorMessage(msg);
      notify?.("Magic Link Failed", msg, "error");
    }
  };

  // Password Reset Request
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    try {
      setBusy(true);
      setErrorMessage(null);
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setBusy(false);
      setSuccessMessage("Password reset email sent. Follow the link to choose a new password.");
      notify?.("Reset Email Sent", "Instructions to reset your password have been emailed.", "info");
    } catch (err: any) {
      setBusy(false);
      const msg = err?.message || "Failed to request password reset.";
      setErrorMessage(msg);
      notify?.("Reset Failed", msg, "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all duration-200"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 sm:p-8 shadow-2xl text-[var(--text)] relative flex flex-col gap-5 overflow-hidden transition-all duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="OmniTube Authentication"
      >
        {/* Decorative Top Accent Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-rose-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-xl p-2 text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] transition"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-slate-950 font-black text-xl shadow-lg shadow-cyan-500/25">
            O
          </div>
          <div>
            <h2 className="text-lg font-black font-['Space_Grotesk'] tracking-tight text-[var(--text)]">
              {mode === "signin" && "Welcome Back"}
              {mode === "signup" && "Create Your Account"}
              {mode === "magic" && "Passwordless Sign-In"}
              {mode === "forgot" && "Reset Password"}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {mode === "signin" && "Sign in to your OmniTube creator universe"}
              {mode === "signup" && "Join millions of next-gen creators & remixers"}
              {mode === "magic" && "One-click email link without passwords"}
              {mode === "forgot" && "We'll send recovery instructions to your email"}
            </p>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        {mode !== "forgot" && (
          <div className="grid grid-cols-3 rounded-2xl bg-[var(--panel-2)] p-1 border border-[var(--border)] text-xs font-semibold">
            <button
              onClick={() => {
                setMode("signin");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-xl transition ${
                mode === "signin"
                  ? "bg-[var(--panel)] text-[var(--text)] shadow font-bold"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-xl transition ${
                mode === "signup"
                  ? "bg-[var(--panel)] text-[var(--text)] shadow font-bold"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Register
            </button>
            <button
              onClick={() => {
                setMode("magic");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-xl transition ${
                mode === "magic"
                  ? "bg-[var(--panel)] text-[var(--text)] shadow font-bold"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              Magic Link
            </button>
          </div>
        )}

        {/* Google OAuth One-Click Button */}
        {mode !== "forgot" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-2)] hover:bg-[var(--panel-3)] p-3 text-xs font-bold text-[var(--text)] shadow-sm transition hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {/* Official Google G Logo SVG */}
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <span className="relative bg-[var(--panel)] px-3 text-[11px] uppercase tracking-wider text-[var(--muted)] font-bold font-mono">
                or with email
              </span>
            </div>
          </div>
        )}

        {/* Error / Success Feedback Banners */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. SIGN IN FORM */}
        {mode === "signin" && (
          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Mail size={13} className="text-cyan-400" /> Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <Lock size={13} className="text-cyan-400" /> Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 pr-10 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[var(--muted)] hover:text-[var(--text)]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Authenticating..." : "Sign In to OmniTube"}
              {!busy && <ArrowRight size={14} />}
            </button>
          </form>
        )}

        {/* 2. REGISTER / CREATE ACCOUNT FORM */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">Display Name</label>
                <input
                  type="text"
                  placeholder="Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">Handle (@username)</label>
                <input
                  type="text"
                  placeholder="alex_creator"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)]">Email Address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Min 6 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Creating Profile..." : "Create Creator Account"}
              {!busy && <Sparkles size={14} />}
            </button>
          </form>
        )}

        {/* 3. MAGIC LINK OTP FORM */}
        {mode === "magic" && (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Mail size={13} className="text-cyan-400" /> Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              We'll send a cryptographic one-time login link to your inbox. Tap it on any device to log in instantly without passwords.
            </p>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Sending Link..." : "Send Magic Sign-In Link"}
              {!busy && <Send size={14} />}
            </button>
          </form>
        )}

        {/* 4. FORGOT PASSWORD FORM */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Mail size={13} className="text-cyan-400" /> Registered Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5 text-xs text-[var(--text)] focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--text)] font-semibold"
              >
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <KeyRound size={13} />
                {busy ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}

        {/* Footer Security Badge */}
        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-400" /> Encrypted by Supabase Auth
          </span>
          <span>PKCE Flow Enabled</span>
        </div>
      </div>
    </div>
  );
}
