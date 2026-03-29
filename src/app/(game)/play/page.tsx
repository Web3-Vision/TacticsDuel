"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSquadStore } from "@/lib/stores/squad-store";
import { useMatchStore } from "@/lib/stores/match-store";
import { simulateMatch } from "@/lib/engine/match-engine";
import { generateAISquad, generateAITactics } from "@/lib/engine/ai-opponent";
import { getFormation } from "@/lib/data/formations";
import type { Player, Tactics } from "@/lib/types";
import { Swords, Users, Bot, Copy, Share2, ArrowLeft, Check } from "lucide-react";

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
  const { slots, formationId, filledCount } = useSquadStore();
  const loadMatch = useMatchStore((s) => s.loadMatch);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    import("@/lib/data/players").then((mod) => setPlayers(mod.PLAYERS));
  }, []);

  const squadReady = filledCount() >= 11;

  // --- VS AI ---
  function handlePlayAI() {
    if (!squadReady || players.length === 0) return;
    setLoading(true);

    const formation = getFormation(formationId);
    const positions = formation.slots.map((s) => s.position);

    const homeSquad = slots.filter((p): p is Player => p !== null);
    const homeTactics: Tactics = {
      formation: formationId,
      mentality: "Balanced",
      tempo: "Normal",
      pressing: "Medium",
      width: "Normal",
    };

    const awaySquad = generateAISquad(players, positions);
    const awayTactics = generateAITactics();

    const result = simulateMatch({
      homeSquad,
      awaySquad,
      homeTactics,
      awayTactics,
      matchType: "ai",
    });

    loadMatch(result, "Your Team", "AI FC");
    router.push("/match/live");
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
        setFriendError(data.error || "Failed to create invite");
        return;
      }
      setCreatedInvite(data.invite);
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
        setFriendError(data.error || "Invite not found");
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
        setFriendError(data.error || "Failed to accept invite");
        return;
      }

      if (data.mode === "bring_squad") {
        // Match created server-side, redirect to live view
        router.push("/match/live");
      } else if (data.mode === "live_draft") {
        // Create draft session then redirect
        const draftRes = await fetch("/api/draft/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId: data.inviteId }),
        });
        const draftData = await draftRes.json();
        if (!draftRes.ok) {
          setFriendError(draftData.error || "Failed to create draft");
          return;
        }
        router.push(`/draft/${draftData.draft.id}`);
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
      const { createClient } = await import("@/lib/supabase/client");
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
            className="font-mono text-xs text-textMid flex items-center gap-1 self-start min-h-[44px]"
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
                  className={`flex-1 font-mono text-xs p-3 min-h-[44px] rounded-md border transition-colors duration-100 ${
                    inviteMode === "bring_squad"
                      ? "border-accent text-accent"
                      : "border-border text-textMid hover:border-border-light"
                  }`}
                >
                  Use Squads
                </button>
                <button
                  onClick={() => setInviteMode("live_draft")}
                  className={`flex-1 font-mono text-xs p-3 min-h-[44px] rounded-md border transition-colors duration-100 ${
                    inviteMode === "live_draft"
                      ? "border-accent text-accent"
                      : "border-border text-textMid hover:border-border-light"
                  }`}
                >
                  Live Draft
                </button>
              </div>
              <p className="font-mono text-[11px] text-textDim">
                {inviteMode === "bring_squad"
                  ? "Both players use their existing squads and tactics."
                  : "Draft players together from a shared pool before the match."}
              </p>
              <button
                onClick={handleCreateInvite}
                disabled={friendLoading}
                className="w-full font-mono text-xs uppercase tracking-wide bg-accent text-bg min-h-[44px] rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40"
              >
                {friendLoading ? "Creating..." : "Create Invite"}
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-textMid uppercase tracking-wide">
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
              <p className="font-mono text-[11px] text-textDim text-center">
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
            className="font-mono text-xs text-textMid flex items-center gap-1 self-start min-h-[44px]"
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
              className="flex-1 font-mono text-sm bg-bg border border-border rounded-md px-3 min-h-[44px] text-text placeholder:text-textDim tracking-[0.2em] text-center focus:outline-none focus:border-accent transition-colors duration-100"
              maxLength={10}
            />
            <button
              onClick={handleLookupInvite}
              disabled={friendLoading || !joinCode.trim()}
              className="font-mono text-xs uppercase tracking-wide bg-accent text-bg min-h-[44px] px-4 rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40"
            >
              {friendLoading ? "..." : "Find"}
            </button>
          </div>

          {fetchedInvite && (
            <div className="bg-bg border border-border rounded-md p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <p className="font-mono text-xs text-textMid">From</p>
                <p className="font-mono text-xs text-text">
                  {fetchedInvite.from_user?.club_name ||
                    fetchedInvite.from_user?.username ||
                    "Unknown"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="font-mono text-xs text-textMid">Mode</p>
                <p className="font-mono text-xs text-text">
                  {fetchedInvite.mode === "bring_squad"
                    ? "Use Squads"
                    : "Live Draft"}
                </p>
              </div>
              <button
                onClick={handleAcceptInvite}
                disabled={friendLoading}
                className="w-full font-mono text-xs uppercase tracking-wide bg-accent text-bg min-h-[44px] rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40 mt-1"
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
            className="font-mono text-xs text-textMid flex items-center gap-1 self-start min-h-[44px]"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>

          <p className="font-mono text-xs text-text uppercase tracking-wide">
            Your Pending Invites
          </p>

          {friendLoading ? (
            <p className="font-mono text-xs text-textDim">Loading...</p>
          ) : pendingInvites.length === 0 ? (
            <p className="font-mono text-xs text-textDim">
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
                    <p className="font-mono text-[11px] text-textDim">
                      {inv.mode === "bring_squad" ? "Use Squads" : "Live Draft"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inv.invite_code);
                    }}
                    className="font-mono text-xs text-textMid min-h-[44px] px-3 hover:text-text transition-colors duration-100"
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
          <span className="text-textDim">&rarr;</span>
        </button>
        <button
          onClick={() => setFriendView("join")}
          className="w-full font-mono text-xs text-left bg-bg border border-border rounded-md p-3 min-h-[44px] flex items-center justify-between hover:border-border-light transition-colors duration-100"
        >
          <span>Join with Code</span>
          <span className="text-textDim">&rarr;</span>
        </button>
        <button
          onClick={() => {
            setFriendView("pending");
            loadPendingInvites();
          }}
          className="w-full font-mono text-xs text-left bg-bg border border-border rounded-md p-3 min-h-[44px] flex items-center justify-between hover:border-border-light transition-colors duration-100"
        >
          <span>My Pending Invites</span>
          <span className="text-textDim">&rarr;</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-mono text-lg uppercase tracking-wide">Play</h1>

      {!squadReady && (
        <div className="bg-surface-alt border border-border rounded-md p-3">
          <p className="font-mono text-xs text-gold">
            Build your squad first ({filledCount()}/11 players)
          </p>
        </div>
      )}

      {/* VS AI */}
      <button
        onClick={handlePlayAI}
        disabled={!squadReady || loading}
        className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
      >
        <Bot size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">VS AI</p>
          <p className="text-text-dim text-xs mt-0.5">
            Practice match against computer
          </p>
        </div>
      </button>

      {/* Ranked */}
      <button
        disabled={!squadReady}
        className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
      >
        <Swords size={24} strokeWidth={1.5} className="text-accent shrink-0" />
        <div className="flex-1">
          <p className="font-mono text-md uppercase tracking-wide">Ranked</p>
          <p className="text-text-dim text-xs mt-0.5">
            Climb the divisions
          </p>
        </div>
      </button>

      {/* VS Friend */}
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
          className="w-full bg-surface border border-border rounded-md p-4 flex items-center gap-4 hover:border-border-light transition-colors duration-100 disabled:opacity-40 text-left"
        >
          <Users size={24} strokeWidth={1.5} className="text-accent shrink-0" />
          <div className="flex-1">
            <p className="font-mono text-md uppercase tracking-wide">
              VS Friend
            </p>
            <p className="text-text-dim text-xs mt-0.5">
              Challenge a friend
            </p>
          </div>
        </button>

        {showFriend && (
          <div className="bg-surface border border-border border-t-0 rounded-b-md p-4">
            {renderFriendContent()}
          </div>
        )}
      </div>
    </div>
  );
}
