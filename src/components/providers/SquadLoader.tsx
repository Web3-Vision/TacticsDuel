"use client";

import { useEffect, useRef } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";

export default function SquadLoader() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    async function load() {
      try {
        await useSquadStore.getState().loadFromSupabase();
      } catch (e) {
        console.error("[SquadLoader] failed to load squad:", e);
        // Still mark as loaded so UI doesn't hang
        useSquadStore.setState({ squadLoaded: true });
      }
    }
    load();
  }, []);

  return null;
}
