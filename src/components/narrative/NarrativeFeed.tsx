import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NarrativeItem } from "@/lib/narrative/content-system";

interface NarrativeFeedProps {
  items: NarrativeItem[];
  maxItems?: number;
  compact?: boolean;
  emptyLabel: string;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function NarrativeFeed({
  items,
  maxItems = 3,
  compact = false,
  emptyLabel,
}: NarrativeFeedProps) {
  const visible = items.slice(0, maxItems);

  if (visible.length === 0) {
    return <p className="font-mono text-xs text-text-dim">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item) => (
        <article
          key={item.id}
          className={cn(
            "rounded-md border bg-bg/65",
            compact ? "px-2.5 py-2" : "p-3",
            item.tone === "positive" && "border-win/40",
            item.tone === "negative" && "border-loss/40",
            item.tone === "neutral" && "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-dim">
              {item.tags[0] ?? item.channel}
            </p>
            <p className="font-mono text-[10px] text-text-dim">{formatTimestamp(item.occurredAt)}</p>
          </div>
          <p className={cn("mt-1 font-mono text-text", compact ? "text-xs" : "text-sm")}>{item.title}</p>
          <p className={cn("mt-1 font-mono text-text-mid", compact ? "text-[11px]" : "text-xs")}>{item.body}</p>
          {item.ctaHref && item.ctaLabel && (
            <Link
              href={item.ctaHref}
              className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
            >
              {item.ctaLabel}
            </Link>
          )}
        </article>
      ))}
    </div>
  );
}
