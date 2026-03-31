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
    <div className="app-shell-bg flex min-h-dvh justify-center">
      <SquadLoader />
      <ServiceWorkerRegistration />

      <aside className="hidden h-[calc(100dvh-4rem)] w-[280px] shrink-0 overflow-y-auto border-r border-border/70 bg-surface/55 p-4 pt-16 backdrop-blur-md lg:block">
        <LeftPanel profile={profile} />
      </aside>

      <div className="relative flex min-h-dvh w-full max-w-[760px] flex-col border-x border-border/40 bg-bg/35 backdrop-blur-[2px]">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto px-1 pb-20 pt-16 md:px-3 md:pb-24">
          {children}
        </main>
        <BottomNav />
      </div>

      <aside className="hidden h-[calc(100dvh-4rem)] w-[280px] shrink-0 overflow-y-auto border-l border-border/70 bg-surface/55 p-4 pt-16 backdrop-blur-md lg:block">
        <RightPanel userId={user?.id ?? null} />
      </aside>
    </div>
  );
}
