"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMagic } from "@/lib/magic/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, TriangleAlert } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const router = useRouter();

  async function handleMagicLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const magic = getMagic();
      const didToken = await magic.auth.loginWithEmailOTP({ email });

      if (!didToken) {
        setError("Magic authentication failed");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ didToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.tempPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh app-shell-bg px-4 py-8 md:py-12">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[460px] flex-col justify-center">
        <div className="glass-panel panel-enter rounded-2xl px-5 py-7 md:px-7 md:py-8">
          <p className="section-title">Welcome Back</p>
          <h1 className="mt-2 font-mono text-xl uppercase tracking-wide text-text md:text-2xl">
            Return To Matchday
          </h1>
          <p className="mt-2 text-sm text-text-mid">
            Use your email OTP to unlock your club dashboard and jump straight
            into queues.
          </p>

          <form onSubmit={handleMagicLogin} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@club.com"
                required
                className="min-h-[46px] rounded-md border border-border bg-surface px-3 font-mono text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-md bg-accent px-4 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-black transition-colors duration-150 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
            >
              <KeyRound size={14} strokeWidth={1.8} />
              {loading ? "Authenticating" : "Continue With OTP"}
            </button>
          </form>

          {error && (
            <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2">
              <p className="flex items-center gap-1.5 font-mono text-xs text-danger">
                <TriangleAlert size={12} strokeWidth={2} />
                {error}
              </p>
            </div>
          )}

          <p className="mt-5 text-xs text-text-mid">
            New manager?{" "}
            <Link href="/signup" className="text-accent hover:text-accent-dim">
              Create your club
            </Link>
          </p>

          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
            Secured by Magic
          </p>
        </div>
      </div>
    </div>
  );
}
