import type { Formation, Position } from "../types";

export const FORMATIONS: Formation[] = [
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "LB", x: 15, y: 72, label: "LB" },
      { position: "CB", x: 37, y: 76, label: "LCB" },
      { position: "CB", x: 63, y: 76, label: "RCB" },
      { position: "RB", x: 85, y: 72, label: "RB" },
      { position: "CM", x: 25, y: 50, label: "LCM" },
      { position: "CM", x: 50, y: 54, label: "CM" },
      { position: "CM", x: 75, y: 50, label: "RCM" },
      { position: "LW", x: 18, y: 24, label: "LW" },
      { position: "ST", x: 50, y: 18, label: "ST" },
      { position: "RW", x: 82, y: 24, label: "RW" },
    ],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "LB", x: 15, y: 72, label: "LB" },
      { position: "CB", x: 37, y: 76, label: "LCB" },
      { position: "CB", x: 63, y: 76, label: "RCB" },
      { position: "RB", x: 85, y: 72, label: "RB" },
      { position: "LW", x: 15, y: 48, label: "LM" },
      { position: "CM", x: 37, y: 52, label: "LCM" },
      { position: "CM", x: 63, y: 52, label: "RCM" },
      { position: "RW", x: 85, y: 48, label: "RM" },
      { position: "ST", x: 37, y: 20, label: "LST" },
      { position: "ST", x: 63, y: 20, label: "RST" },
    ],
  },
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "LB", x: 15, y: 72, label: "LB" },
      { position: "CB", x: 37, y: 76, label: "LCB" },
      { position: "CB", x: 63, y: 76, label: "RCB" },
      { position: "RB", x: 85, y: 72, label: "RB" },
      { position: "CM", x: 37, y: 56, label: "CDM" },
      { position: "CM", x: 63, y: 56, label: "CDM" },
      { position: "LW", x: 18, y: 34, label: "LAM" },
      { position: "CM", x: 50, y: 38, label: "CAM" },
      { position: "RW", x: 82, y: 34, label: "RAM" },
      { position: "ST", x: 50, y: 16, label: "ST" },
    ],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "CB", x: 25, y: 76, label: "LCB" },
      { position: "CB", x: 50, y: 78, label: "CB" },
      { position: "CB", x: 75, y: 76, label: "RCB" },
      { position: "LB", x: 10, y: 50, label: "LWB" },
      { position: "CM", x: 35, y: 54, label: "LCM" },
      { position: "CM", x: 50, y: 50, label: "CM" },
      { position: "CM", x: 65, y: 54, label: "RCM" },
      { position: "RB", x: 90, y: 50, label: "RWB" },
      { position: "ST", x: 37, y: 20, label: "LST" },
      { position: "ST", x: 63, y: 20, label: "RST" },
    ],
  },
  {
    id: "3-4-3",
    name: "3-4-3",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "CB", x: 25, y: 76, label: "LCB" },
      { position: "CB", x: 50, y: 78, label: "CB" },
      { position: "CB", x: 75, y: 76, label: "RCB" },
      { position: "LB", x: 12, y: 50, label: "LWB" },
      { position: "CM", x: 38, y: 54, label: "LCM" },
      { position: "CM", x: 62, y: 54, label: "RCM" },
      { position: "RB", x: 88, y: 50, label: "RWB" },
      { position: "LW", x: 18, y: 24, label: "LW" },
      { position: "ST", x: 50, y: 18, label: "ST" },
      { position: "RW", x: 82, y: 24, label: "RW" },
    ],
  },
  {
    id: "5-3-2",
    name: "5-3-2",
    slots: [
      { position: "GK", x: 50, y: 92, label: "GK" },
      { position: "LB", x: 8, y: 68, label: "LWB" },
      { position: "CB", x: 28, y: 76, label: "LCB" },
      { position: "CB", x: 50, y: 78, label: "CB" },
      { position: "CB", x: 72, y: 76, label: "RCB" },
      { position: "RB", x: 92, y: 68, label: "RWB" },
      { position: "CM", x: 30, y: 50, label: "LCM" },
      { position: "CM", x: 50, y: 48, label: "CM" },
      { position: "CM", x: 70, y: 50, label: "RCM" },
      { position: "ST", x: 37, y: 20, label: "LST" },
      { position: "ST", x: 63, y: 20, label: "RST" },
    ],
  },
];

export function getFormation(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}

export function getPositionNeeds(formation: Formation): Position[] {
  return formation.slots.map((s) => s.position);
}
