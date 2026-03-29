"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full h-10 border border-danger text-danger font-mono text-sm uppercase tracking-wide rounded-[4px] hover:bg-danger-dim/20 transition-colors duration-100"
    >
      Sign Out
    </button>
  );
}
