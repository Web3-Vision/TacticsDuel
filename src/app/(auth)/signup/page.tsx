"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getMagic } from "@/lib/magic/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (username.length < 3 || username.length > 20) {
      setError("Username must be 3-20 characters");
      setLoading(false);
      return;
    }

    if (clubName.length < 2 || clubName.length > 30) {
      setError("Club name must be 2-30 characters");
      setLoading(false);
      return;
    }

    try {
      const magic = getMagic();

      // Authenticate with Magic (email OTP)
      const didToken = await magic.auth.loginWithEmailOTP({ email });

      if (!didToken) {
        setError("Magic authentication failed");
        setLoading(false);
        return;
      }

      // Send DID token + profile data to bridge API
      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ didToken, username, clubName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Sign in to Supabase with the temp password (no emails, no rate limits)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.tempPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-[340px]">
        <h1 className="font-mono text-xl font-semibold tracking-wider uppercase text-center mb-1">
          Create Your Club
        </h1>
        <p className="text-text-dim text-sm text-center mb-8">
          Pick a name and start competing
        </p>

        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            maxLength={20}
            className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
          />
          <input
            type="text"
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            placeholder="Club name (e.g. FC Thunder)"
            required
            maxLength={30}
            className="w-full h-[44px] bg-surface border border-border rounded-[4px] px-3 font-mono text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-100"
          />
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
            {loading ? "Creating..." : "Create Club"}
          </button>
        </form>

        {error && (
          <p className="text-danger text-xs font-mono mt-3">{error}</p>
        )}

        <p className="text-text-dim text-xs text-center mt-6">
          Already have a club?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>

        <p className="text-text-dim text-xs text-center mt-3 opacity-50">
          Powered by Magic
        </p>
      </div>
    </div>
  );
}
