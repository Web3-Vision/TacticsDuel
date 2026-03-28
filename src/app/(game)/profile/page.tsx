"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="p-4">
      <h1 className="font-mono text-lg uppercase tracking-wide mb-4">
        Profile
      </h1>
      <p className="text-text-mid text-sm mb-6">Profile details coming soon.</p>
      <button
        onClick={handleSignOut}
        className="w-full h-10 border border-danger text-danger font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-danger-dim/20 transition-colors duration-100"
      >
        Sign Out
      </button>
    </div>
  );
}
