"use client";

import PitchView from "@/components/pitch/PitchView";
import TacticsForm from "@/components/squad/TacticsForm";

export default function TacticsPage() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-20">
      <PitchView />
      <TacticsForm showFormation={true} stickyButton={true} />
    </div>
  );
}
