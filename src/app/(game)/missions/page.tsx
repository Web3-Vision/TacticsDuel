"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Target, Gift, Clock, CheckCircle } from "lucide-react";

interface Mission {
  id: string;
  mission_type: string;
  mission_key: string;
  description: string;
  target: number;
  progress: number;
  reward_coins: number;
  completed: boolean;
  claimed: boolean;
  expires_at: string;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    fetchMissions();
  }, []);

  async function fetchMissions() {
    const res = await fetch("/api/missions");
    const data = await res.json();
    setMissions(data.missions ?? []);
    setLoading(false);
  }

  async function claimMission(missionId: string) {
    setClaiming(missionId);
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId }),
    });
    const data = await res.json();
    if (data.success) {
      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m))
      );
    }
    setClaiming(null);
  }

  const dailyMissions = missions.filter((m) => m.mission_type === "daily");
  const weeklyMissions = missions.filter((m) => m.mission_type === "weekly");

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="font-mono text-lg uppercase tracking-wide mb-4">Missions</h1>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface border border-border rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="font-mono text-lg uppercase tracking-wide">Missions</h1>

      {/* Daily missions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-accent" />
          <h2 className="font-mono text-xs text-text-dim uppercase tracking-wide">Daily</h2>
        </div>
        <div className="flex flex-col gap-2">
          {dailyMissions.length === 0 ? (
            <p className="font-mono text-xs text-text-dim">No daily missions. Check back tomorrow.</p>
          ) : (
            dailyMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onClaim={() => claimMission(m.id)}
                claiming={claiming === m.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Weekly missions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-gold" />
          <h2 className="font-mono text-xs text-text-dim uppercase tracking-wide">Weekly</h2>
        </div>
        <div className="flex flex-col gap-2">
          {weeklyMissions.length === 0 ? (
            <p className="font-mono text-xs text-text-dim">No weekly missions. Check back next week.</p>
          ) : (
            weeklyMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onClaim={() => claimMission(m.id)}
                claiming={claiming === m.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  onClaim,
  claiming,
}: {
  mission: Mission;
  onClaim: () => void;
  claiming: boolean;
}) {
  const isComplete = mission.progress >= mission.target;
  const progress = Math.min(mission.progress / mission.target, 1);

  return (
    <div className={cn(
      "bg-surface border rounded-md p-3",
      isComplete && !mission.claimed ? "border-accent/40" : "border-border"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-mono text-xs",
            mission.claimed ? "text-text-dim line-through" : "text-text"
          )}>
            {mission.description}
          </p>

          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-sm overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  isComplete ? "bg-accent" : "bg-accent/50"
                )}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-text-dim tabular-nums shrink-0">
              {mission.progress}/{mission.target}
            </span>
          </div>
        </div>

        {/* Reward / Claim */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <Gift size={12} className="text-gold" />
            <span className="font-mono text-xs text-gold tabular-nums">
              {mission.reward_coins}
            </span>
          </div>

          {isComplete && !mission.claimed && (
            <button
              onClick={onClaim}
              disabled={claiming}
              className="h-7 px-3 bg-accent text-black font-mono text-[10px] uppercase tracking-wide rounded-[3px] hover:bg-accent-dim transition-colors duration-100"
            >
              {claiming ? "..." : "Claim"}
            </button>
          )}

          {mission.claimed && (
            <div className="flex items-center gap-1">
              <CheckCircle size={12} className="text-accent" />
              <span className="font-mono text-[10px] text-accent">Claimed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
