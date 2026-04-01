"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMagic } from "@/lib/magic/client";
import {
  MANAGER_ARCHETYPES,
  HAIR_STYLES,
  HAIR_COLORS,
  SKIN_TONES,
  BEARD_STYLES,
  type AccountStatus,
  type ManagerArchetype,
  type HairStyle,
  type HairColor,
  type SkinTone,
  type BeardStyle,
} from "@/lib/profile-options";

type ManagerProfilePanelProps = {
  managerName: string;
  age: number | null;
  favoriteTeam: string | null;
  managerArchetype: ManagerArchetype;
  hairStyle: HairStyle;
  hairColor: HairColor;
  skinTone: SkinTone;
  beardStyle: BeardStyle;
  accountStatus: AccountStatus;
};

export default function ManagerProfilePanel({
  managerName,
  age,
  favoriteTeam,
  managerArchetype,
  hairStyle,
  hairColor,
  skinTone,
  beardStyle,
  accountStatus,
}: ManagerProfilePanelProps) {
  const supabase = createClient();
  const router = useRouter();

  const [nameValue, setNameValue] = useState(managerName);
  const [ageValue, setAgeValue] = useState(age ? String(age) : "");
  const [favoriteTeamValue, setFavoriteTeamValue] = useState(favoriteTeam ?? "");
  const [archetypeValue, setArchetypeValue] = useState<ManagerArchetype>(managerArchetype);
  const [hairStyleValue, setHairStyleValue] = useState<HairStyle>(hairStyle);
  const [hairColorValue, setHairColorValue] = useState<HairColor>(hairColor);
  const [skinToneValue, setSkinToneValue] = useState<SkinTone>(skinTone);
  const [beardStyleValue, setBeardStyleValue] = useState<BeardStyle>(beardStyle);
  const [statusValue, setStatusValue] = useState<AccountStatus>(accountStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusPillClass = useMemo(() => {
    if (statusValue === "active") return "text-win border-win/40 bg-win/15";
    if (statusValue === "paused") return "text-gold border-gold/40 bg-gold/10";
    return "text-danger border-danger/40 bg-danger/10";
  }, [statusValue]);

  async function patchProfile(payload: Record<string, unknown>) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to update profile");
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await patchProfile({
        manager_name: nameValue.trim(),
        age: ageValue ? Number(ageValue) : null,
        favorite_team: favoriteTeamValue.trim() || null,
        manager_avatar_archetype: archetypeValue,
        manager_hair_style: hairStyleValue,
        manager_hair_color: hairColorValue,
        manager_skin_tone: skinToneValue,
        manager_beard_style: beardStyleValue,
      });
      setMessage("Manager profile saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handlePauseToggle() {
    if (statusValue === "deactivated") return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const nextStatus: AccountStatus = statusValue === "paused" ? "active" : "paused";

    try {
      await patchProfile({ account_status: nextStatus });
      setStatusValue(nextStatus);
      setMessage(nextStatus === "paused" ? "Account paused. Matchmaking and progression are suspended." : "Account resumed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change account status");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (statusValue === "deactivated") return;

    const confirmed = window.confirm(
      "Deactivate account permanently? You will be signed out and gameplay access will be disabled."
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await patchProfile({ account_status: "deactivated" });
      setStatusValue("deactivated");
      try {
        const magic = getMagic();
        if (await magic.user.isLoggedIn()) {
          await magic.user.logout();
        }
      } catch {
        // best effort
      }
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate account");
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border-light/70 bg-gradient-to-br from-surface-alt/70 to-surface/85 p-3 shadow-[0_12px_24px_rgba(1,4,9,0.25)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">Manager Profile</p>
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${statusPillClass}`}>
          {statusValue}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Field label="Manager Name">
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={40}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          />
        </Field>

        <Field label="Age">
          <input
            type="number"
            value={ageValue}
            onChange={(e) => setAgeValue(e.target.value)}
            min={13}
            max={80}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          />
        </Field>

        <Field label="Favorite Team">
          <input
            value={favoriteTeamValue}
            onChange={(e) => setFavoriteTeamValue(e.target.value)}
            maxLength={60}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          />
        </Field>

        <Field label="Character">
          <select
            value={archetypeValue}
            onChange={(e) => setArchetypeValue(e.target.value as ManagerArchetype)}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          >
            {MANAGER_ARCHETYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Hair Style">
          <select
            value={hairStyleValue}
            onChange={(e) => setHairStyleValue(e.target.value as HairStyle)}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          >
            {HAIR_STYLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Hair Color">
          <select
            value={hairColorValue}
            onChange={(e) => setHairColorValue(e.target.value as HairColor)}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          >
            {HAIR_COLORS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Skin Tone">
          <select
            value={skinToneValue}
            onChange={(e) => setSkinToneValue(e.target.value as SkinTone)}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          >
            {SKIN_TONES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Beard">
          <select
            value={beardStyleValue}
            onChange={(e) => setBeardStyleValue(e.target.value as BeardStyle)}
            className="h-10 w-full rounded-md border border-border bg-surface px-2.5 font-mono text-xs text-text focus:border-accent focus:outline-none"
          >
            {BEARD_STYLES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleSaveProfile}
          disabled={saving || statusValue === "deactivated"}
          className="h-9 rounded-md bg-accent px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-black hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Manager
        </button>
        <button
          onClick={handlePauseToggle}
          disabled={saving || statusValue === "deactivated"}
          className="h-9 rounded-md border border-gold/50 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statusValue === "paused" ? "Resume Account" : "Pause Account"}
        </button>
        <button
          onClick={handleDeactivate}
          disabled={saving || statusValue === "deactivated"}
          className="h-9 rounded-md border border-danger/50 px-3 font-mono text-[11px] uppercase tracking-[0.12em] text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Deactivate Account
        </button>
      </div>

      {message && <p className="mt-2 font-mono text-[11px] text-win">{message}</p>}
      {error && <p className="mt-2 font-mono text-[11px] text-danger">{error}</p>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</span>
      {children}
    </label>
  );
}
