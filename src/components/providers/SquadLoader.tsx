"use client";

import { useEffect, useRef } from "react";
import { useSquadStore } from "@/lib/stores/squad-store";

export default function SquadLoader() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    useSquadStore.getState().loadFromSupabase();
  }, []);

  return null;
}
