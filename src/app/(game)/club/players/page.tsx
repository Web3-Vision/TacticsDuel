import { redirect } from "next/navigation";

export default function LegacyTransfersRedirect() {
  redirect("/club/market");
}
