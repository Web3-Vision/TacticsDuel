"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        ref={ref}
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-surface border-t border-border rounded-t-md overflow-y-auto pb-safe"
      >
        {title && (
          <div className="sticky top-0 bg-surface flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-mono text-md uppercase tracking-wide">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-text-dim hover:text-text"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
