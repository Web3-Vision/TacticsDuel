"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSquadStore } from "@/lib/stores/squad-store";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Swords, Users, Bot, Copy, Share2, ArrowLeft, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluateRankedReadiness, RANKED_MIN_STARTERS } from "@/lib/multiplayer/competitive-flow";
import { countSavedStarters } from "@/lib/squad/persisted-squad";

type FriendView = "menu" | "create" | "join" | "pending";
type InviteMode = "bring_squad" | "live_draft";

interface Invite {
  id: string;
  invite_code: string;
  mode: InviteMode;
  status: string;
  from_user_id: string;
  from_user?: { username: string; club_name: string };
}

export default function PlayPage() {
  const router = useRouter();
  const { filledCount } = useSquadStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [squadSaved, setSquadSaved] = useState(false);
  const [savedStarterCount, setSavedStarterCount] = useState(0);
  const [tacticsSaved, setTacticsSaved] = useState(false);
  const [checking, setChecking] = useState(true);

  // Friend match state
  const [friendView, setFriendView] = useState<FriendView>("menu");
  const [inviteMode, setInviteMode] = useState<InviteMode>("bring_squad");
  const [createdInvite, setCreatedInvite] = useState<Invite | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [fetchedInvite, setFetchedInvite] = useState<Invite | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [friendError, setFriendError] = useState("");
  const [friendLoading, setFriendLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFriend, setShowFriend] = useState(false);

  // Check if squad and tactics are saved to DB, and load profile
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      const [profileRes, squadRes, tacticsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("squads").select("player_ids").eq("user_id", user.id).maybeSingle(),
        supabase.from("tactics").select("user_id").eq("user_id", user.id).single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      const starters = countSavedStarters(squadRes.data);
      setSavedStarterCount(starters);
      setSquadSaved(starters >= RANKED_MIN_STARTERS);
      setTacticsSaved(!!tacticsRes.data);
      setChecking(false);
    }
    check();
  }, []);

  const squadReady = filledCount() >= RANKED_MIN_STARTERS;
  const rankedReadiness = evaluateRankedReadiness({
    localFilledCount: filledCount(),
    savedStarterCount,
    hasTactics: tacticsSaved,
    squadLocked: Boolean(profile?.squad_locked),
  });
  const rankedReady = rankedReadiness.isReady;

  // --- VS AI ---
  function handlePlayAI() {
    if (!squadReady) return;
    router.push("/play/confirm?mode=ai");
  }

  // --- Ranked ---
  function handlePlayRanked() {
    if (!rankedReady) return;
    router.push("/play/confirm?mode=ranked");
  }

  // --- Friend Match: Create Invite ---
  async function handleCreateInvite() {
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch("/api/match/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: inviteMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFriendError(data.error?.message || data.error || "Failed to create invite");
        return;
      }
      if (data.status !== "invite_created" || !data.invite) {
        setFriendError("Unexpected invite response");
        return;
      }
      setCreatedInvite(data.invite);
      setPendingInvites((current) => [data.invite, ...current]);
    } catch {
      setFriendError("Network error");
    } finally {
      setFriendLoading(false);
    }
  }

  function handleCopyCode() {
    if (!createdInvite) return;
    navigator.clipboard.writeText(createdInvite.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!createdInvite || !navigator.share) return;
    navigator.share({
      title: "TacticsDuel Friend Match",
      text: `Join my match! Code: ${createdInvite.invite_code}`,
    });
  }

  // --- Friend Match: Join Invite ---
  async function handleLookupInvite() {
    if (!joinCode.trim()) return;
    setFriendLoading(true);
    setFriendError("");
    setFetchedInvite(null);
    try {
      const res = await fetch(
        `/api/match/invite?code=${encodeURIComponent(joinCode.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setFriendError(data.error?.message || data.error || "Invite not found");
        return;
      }
      if (data.status !== "invite_ready" || !data.invite) {
        setFriendError("Unexpected invite response");
        return;
      }
      setFetchedInvite(data.invite);
    } catch {
      setFriendError("Network error");
    } finally {
      setFriendLoading(false);
    }
  }

  async function handleAcceptInvite() {
    if (!fetchedInvite) return;
    setFriendLoading(true);
    setFriendError("");
    try {
      const res = await fetch("/api/match/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: fetchedInvite.invite_code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFriendError(data.error?.message || data.error || "Failed to accept invite");
        return;
      }

      if (data.status === "match_ready" && data.mode === "bring_squad") {
        router.push("/match/live");
      } else if (data.status === "draft_ready" && data.mode === "live_draft") {
        const draftRes = await fetch("/api/draft/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId: data.inviteId }),
        });
        const draftData = await draftRes.json();
        if (!draftRes.ok) {
          setFriendError(draftData.error?.message || draftData.error || "Failed to create draft");
          return;
        }
        router.push(`/draft/${draftData.draft.id}`);
      } else {
        setFriendError("Unexpected invite acceptance response");
      }
    } catch {
      setFriendError("Network error");
    } finally {
      setFriendLoading(false);
    }
  }

  // --- Friend Match: Load Pending Invites ---
  const loadPendingInvites = useCallback(async () => {
    setFriendLoading(true);
    setFriendError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFriendError("Not logged in");
        return;
      }
      const { data, error } = await supabase
        .from("friend_invites")
        .select("*")
        .eq("from_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) {
        setFriendError("Failed to load invites");
        return;
      }
      setPendingInvites(data ?? []);
    } catch {
      setFriendError("Network error");
    } finally {
      setFriendLoading(false);
    }
  }, []);

  // --- Reset friend state when closing ---
  function resetFriendState() {
    setShowFriend(false);
    setFriendView("menu");
    setCreatedInvite(null);
    setFetchedInvite(null);
    setJoinCode("");
    setFriendError("");
    setCopied(false);
  }

  // --- Render Friend Section ---
  function renderFriendContent() {
    if (friendView === "create") {
      return (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setFriendView("menu");
              setCreatedInvite(null);
              setFriendError("");
            }}
            className="font-mono text-xs text-text-mid flex items-center gap-1 self-start min-h-[44px]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>

          {!createdInvite ? (
            <>
              <p className="font-mono text-xs text-text uppercase tracking-wide">
                Choose mode
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteMode("bring_squad")}
                  className={cn(
                    "flex-1 font-mono text-xs p-3 min-h-[44px] rounded-md border transition-colors duration-100",
                    inviteMode === "bring_squad"
                      ? "border-accent text-accent"
                      : "border-border text-text-mid hover:border-border-light"
                  )}
                >
                  Use Squads
                </button>
                <button
                  onClick={() => setInviteMode("live_draft")}
                  className={cn(
                    "flex-1 font-mono text-xs p-3 min-h-[44px] rounded-md border transition-colors duration-100",
                    inviteMode === "live_draft"
                      ? "border-accent text-accent"
                      : "border-border text-text-mid hover:border-border-light"
                  )}
                >
                  Live Draft
                </button>
              </div>
              <p className="font-mono text-[11px] text-text-dim">
                {inviteMode === "bring_squad"
                  ? "Both players use their existing squads and tactics."
                  : "Draft players together from a shared pool before the match."}
              </p>
              <button
                onClick={handleCreateInvite}
                disabled={friendLoading}
                className="w-full font-mono text-xs uppercase tracking-wide bg-accent text-black min-h-[44px] rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40"
              >
                {friendLoading ? "Creating..." : "Create Invite"}
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-text-mid uppercase tracking-wide">
                Invite Code
              </p>
              <div className="bg-bg border border-border rounded-md p-4 text-center">
                <p className="font-mono text-2xl tracking-[0.3em] text-accent">
                  {createdInvite.invite_code}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 font-mono text-xs min-h-[44px] rounded-md border border-border flex items-center justify-center gap-2 hover:border-border-light transition-colors duration-100"
                >
                  {copied ? (
                    <>
                      <Check size={14} strokeWidth={1.5} className="text-accent" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} strokeWidth={1.5} />
                      Copy Code
                    </>
                  )}
                </button>
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    onClick={handleShare}
                    className="font-mono text-xs min-h-[44px] px-4 rounded-md border border-border flex items-center justify-center gap-2 hover:border-border-light transition-colors duration-100"
                  >
                    <Share2 size={14} strokeWidth={1.5} />
                    Share
                  </button>
                )}
              </div>
              <p className="font-mono text-[11px] text-text-dim text-center">
                Share this code with a friend. Mode:{" "}
                {createdInvite.mode === "bring_squad"
                  ? "Use Squads"
                  : "Live Draft"}
              </p>
            </>
          )}

          {friendError && (
            <p className="font-mono text-xs text-red-400">{friendError}</p>
          )}
        </div>
      );
    }

    if (friendView === "join") {
      return (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setFriendView("menu");
              setFetchedInvite(null);
              setJoinCode("");
              setFriendError("");
            }}
            className="font-mono text-xs text-text-mid flex items-center gap-1 self-start min-h-[44px]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>

          <p className="font-mono text-xs text-text uppercase tracking-wide">
            Enter invite code
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              className="flex-1 font-mono text-sm bg-bg border border-border rounded-md px-3 min-h-[44px] text-text placeholder:text-text-dim tracking-[0.2em] text-center focus:outline-none focus:border-accent transition-colors duration-100"
              maxLength={10}
            />
            <button
              onClick={handleLookupInvite}
              disabled={friendLoading || !joinCode.trim()}
              className="font-mono text-xs uppercase tracking-wide bg-accent text-black min-h-[44px] px-4 rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40"
            >
              {friendLoading ? "..." : "Find"}
            </button>
          </div>

          {fetchedInvite && (
            <div className="bg-bg border border-border rounded-md p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p className="font-mono text-xs text-text-mid">From</p>
                <p className="font-mono text-xs text-text">
                  {fetchedInvite.from_user?.club_name ||
                    fetchedInvite.from_user?.username ||
                    "Unknown"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="font-mono text-xs text-text-mid">Mode</p>
                <p className="font-mono text-xs text-text">
                  {fetchedInvite.mode === "bring_squad"
                    ? "Use Squads"
                    : "Live Draft"}
                </p>
              </div>
              <button
                onClick={handleAcceptInvite}
                disabled={friendLoading}
                className="w-full font-mono text-xs uppercase tracking-wide bg-accent text-black min-h-[44px] rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40 mt-1"
              >
                {friendLoading ? "Accepting..." : "Accept Invite"}
              </button>
            </div>
          )}

          {friendError && (
            <p className="font-mono text-xs text-red-400">{friendError}</p>
          )}
        </div>
      );
    }

    if (friendView === "pending") {
      return (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setFriendView("menu");
              setFriendError("");
            }}
            className="font-mono text-xs text-text-mid flex items-center gap-1 self-start min-h-[44px]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>

          <p className="font-mono text-xs text-text uppercase tracking-wide">
            Your Pending Invites
          </p>

          {friendLoading ? (
            <p className="font-mono text-xs text-text-dim">Loading...</p>
          ) : pendingInvites.length === 0 ? (
            <p className="font-mono text-xs text-text-dim">
              No pending invites.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-bg border border-border rounded-md p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-mono text-sm text-accent tracking-[0.2em]">
                      {inv.invite_code}
                    </p>
                    <p className="font-mono text-[11px] text-text-dim">
                      {inv.mode === "bring_squad" ? "Use Squads" : "Live Draft"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inv.invite_code);
                    }}
                    className="font-mono text-xs text-text-mid min-h-[44px] px-3 hover:text-text transition-colors duration-100"
                  >
                    <Copy size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {friendError && (
            <p className="font-mono text-xs text-red-400">{friendError}</p>
          )}
        </div>
      );
    }

    // Default: menu view
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setFriendView("create")}
          className="w-full font-mono text-xs text-left bg-bg border border-border rounded-md p-3 min-h-[44px] flex items-center justify-between hover:border-border-light transition-colors duration-100"
        >
          <span>Create Invite</span>
          <span className="text-text-dim">&rarr;</span>
        </button>
        <button
          onClick={() => setFriendView("join")}
          className="w-full font-mono text-xs text-left bg-bg border border-border rounded-md p-3 min-h-[44px] flex items-center justify-between hover:border-border-light transition-colors duration-100"
        >
          <span>Join with Code</span>
          <span className="text-text-dim">&rarr;</span>
        </button>
        <button
          onClick={() => {
            setFriendView("pending");
            loadPendingInvites();
          }}
          className="w-full font-mono text-xs text-left bg-bg border border-border rounded-md p-3 min-h-[44px] flex items-center justify-between hover:border-border-light transition-colors duration-100"
        >
          <span>My Pending Invites</span>
          <span className="text-text-dim">&rarr;</span>
        </button>
      </div>
    );
  }

  const rankedMessage = rankedReadiness.message;
  const rankedActionLabel = rankedReadiness.code === "squad_unlocked"
    ? "Lock required"
    : rankedReady
      ? "Ready"
      : "Needs setup";

  return (
    <div className="flex flex-col gap-3 p-3 pb-20 md:p-4 md:pb-24">
      <section className="glass-panel panel-enter rounded-xl p-3">
        <p className="section-title">Match Center</p>
        <h1 className="mt-1 font-mono text-lg uppercase tracking-[0.12em] text-text">
          Select Your Arena
        </h1>
        <p className="mt-1 text-xs text-text-mid">
          Keep your squad ready, then queue AI practice, friend duels, or ranked progression.
        </p>
      </section>

      {!squadReady && (
        <div className="rounded-md border border-gold/45 bg-gold/10 p-3">
          <p className="font-mono text-xs text-gold">
            Build your squad first ({filledCount()}/11 players filled).
          </p>
        </div>
      )}

      <button
        onClick={handlePlayAI}
        disabled={!squadReady}
        className="glass-panel panel-enter w-full rounded-xl p-4 text-left transition-colors duration-150 hover:border-border-light disabled:opacity-45"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md border border-border bg-bg/65">
            <Bot size={20} strokeWidth={1.8} className="text-accent shrink-0" />
          </div>
          <div className="flex-1">
            <p className="font-mono text-sm uppercase tracking-[0.12em] text-text">VS AI</p>
            <p className="mt-0.5 text-xs text-text-mid">
              Warm-up fixture with no ranked pressure.
            </p>
          </div>
        </div>
      </button>

      <button
        onClick={handlePlayRanked}
        disabled={!rankedReady || checking}
        className={cn(
          "panel-enter w-full rounded-xl border p-4 text-left transition-colors duration-150",
          rankedReady
            ? "glass-panel border-accent/35 hover:border-accent"
            : "glass-panel border-border disabled:opacity-45"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md border border-border bg-bg/65">
            <Swords size={20} strokeWidth={1.8} className="text-accent shrink-0" />
          </div>
          <div className="flex-1">
            <p className="font-mono text-sm uppercase tracking-[0.12em] text-text">Ranked</p>
            <p className={cn("mt-0.5 text-xs", rankedReady ? "text-text-mid" : "text-gold")}>
              {checking ? "Checking readiness..." : rankedMessage}
            </p>
          </div>
          <span
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]",
              rankedReady
                ? "border-accent/45 bg-accent/10 text-accent"
                : "border-gold/45 bg-gold/10 text-gold",
            )}
          >
            {rankedActionLabel}
          </span>
          {profile?.squad_locked && (
            <Lock size={14} strokeWidth={1.8} className="text-accent shrink-0" />
          )}
        </div>
      </button>

      <div className="flex flex-col">
        <button
          onClick={() => {
            if (showFriend) {
              resetFriendState();
            } else {
              setShowFriend(true);
            }
          }}
          disabled={!squadReady}
          className="glass-panel panel-enter w-full rounded-xl p-4 text-left transition-colors duration-150 hover:border-border-light disabled:opacity-45"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md border border-border bg-bg/65">
              <Users size={20} strokeWidth={1.8} className="text-accent shrink-0" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-sm uppercase tracking-[0.12em] text-text">VS Friend</p>
              <p className="mt-0.5 text-xs text-text-mid">Invite flow with code share and quick join.</p>
            </div>
          </div>
        </button>

        {showFriend && (
          <div className="glass-panel rounded-b-xl border-t-0 p-4">
            {renderFriendContent()}
          </div>
        )}
      </div>

      {squadReady && !rankedReady && !checking && (
        <section className="glass-panel panel-enter rounded-xl p-3">
          <p className="section-title">Ranked Checklist</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <CheckItem done={squadSaved} label={`Squad saved to server (${savedStarterCount}/${RANKED_MIN_STARTERS})`} />
            <CheckItem done={tacticsSaved} label="Tactics configured and saved" />
            <CheckItem done={profile?.squad_locked ?? false} label="Squad locked for ranked" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/club/squad"
              className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
            >
              Review Squad
            </Link>
            <Link
              href="/club/tactics"
              className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-border px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-text-mid transition-colors duration-150 hover:border-border-light hover:text-text"
            >
              Adjust Tactics
            </Link>
            <Link
              href="/club/team-hub"
              className="inline-flex min-h-[36px] items-center justify-center rounded-md border border-accent/45 bg-accent/10 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors duration-150 hover:border-accent"
            >
              Lock In Team Hub
            </Link>
          </div>
        </section>
      )}

      {!checking && profile?.squad_locked && (
        <section className="glass-panel panel-enter rounded-xl border border-accent/35 p-3">
          <p className="section-title">Lock State</p>
          <p className="mt-1 font-mono text-xs text-accent">
            Ranked lock active. Your squad is protected until the cycle resets.
          </p>
          <p className="mt-1 text-xs text-text-mid">
            You can still browse the market and prep future moves, but lineup edits stay frozen.
          </p>
        </section>
      )}
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-bg/60 px-2.5 py-2">
      <div className={cn(
        "h-3 w-3 rounded-sm flex items-center justify-center",
        done ? "bg-accent/20" : "bg-border"
      )}>
        {done && <span className="text-accent text-[8px] font-bold">✓</span>}
      </div>
      <span className={cn(
        "font-mono text-xs",
        done ? "text-text-mid" : "text-text-dim"
      )}>
        {label}
      </span>
    </div>
  );
}
