import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/layout/BottomNav";
import LeftPanel from "@/components/layout/LeftPanel";
import RightPanel from "@/components/layout/RightPanel";
import SquadLoader from "@/components/providers/SquadLoader";
import ServiceWorkerRegistration from "@/components/providers/ServiceWorkerRegistration";
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
    <div className="flex justify-center min-h-dvh">
      <SquadLoader />
      <ServiceWorkerRegistration />

      {/* Left panel — desktop only */}
      <aside className="hidden lg:block w-[280px] shrink-0 sticky top-12 h-[calc(100dvh-3rem)] overflow-y-auto border-r border-border bg-bg p-4">
        <LeftPanel profile={profile} />
      </aside>

      {/* Main content */}
      <div className="flex flex-col min-h-dvh max-w-[480px] w-full">
        <TopBar profile={profile} />
        <main className="flex-1 pt-12 pb-14 overflow-y-auto">{children}</main>
        <BottomNav />
      </div>

      {/* Right panel — desktop only */}
      <aside className="hidden lg:block w-[280px] shrink-0 sticky top-12 h-[calc(100dvh-3rem)] overflow-y-auto border-l border-border bg-bg p-4">
        <RightPanel userId={user?.id ?? null} />
      </aside>
    </div>
  );
}
