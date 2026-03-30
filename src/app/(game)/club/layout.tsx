import ClubSubNav from "@/components/layout/ClubSubNav";

export default function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <ClubSubNav />
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
