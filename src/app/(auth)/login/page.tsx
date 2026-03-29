"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-[340px]">
        <h1 className="font-mono text-xl font-semibold tracking-wider uppercase text-center mb-1">
          TacticsDuel
        </h1>
        <p className="text-text-dim text-sm text-center mb-8">
          Build. Tacticate. Duel.
        </p>

        {sent ? (
          <div className="bg-surface border border-border rounded-md p-4">
            <p className="font-mono text-sm text-accent">Check your email</p>
            <p className="text-text-mid text-xs mt-2">
              We sent a login link to {email}
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogle}
              className="w-full h-[44px] bg-surface border border-border rounded-[4px] font-mono text-sm uppercase tracking-wide text-text hover:border-border-light transition-colors duration-100"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-text-dim text-xs font-mono uppercase">
                or
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[44px] bg-accent text-black font-mono text-sm font-medium uppercase tracking-wide rounded-[4px] hover:bg-accent-dim transition-colors duration-100 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="text-danger text-xs font-mono mt-3">{error}</p>
        )}

        <p className="text-text-dim text-xs text-center mt-6">
          New here?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create a club
          </Link>
        </p>
      </div>
    </div>
  );
}
