import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import type { Profile } from "@/lib/types";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = data as Profile | null;
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-[480px] mx-auto w-full">
      <TopBar profile={profile} />
      <main className="flex-1 pt-12 pb-14 overflow-y-auto">{children}</main>
      <BottomNav />
    </div>
  );
}
