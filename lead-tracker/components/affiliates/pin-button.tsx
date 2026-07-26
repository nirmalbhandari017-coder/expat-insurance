"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { togglePinAffiliate } from "@/lib/actions/affiliates";
import { cn } from "@/lib/utils";

export function PinButton({ affiliateId, pinned }: { affiliateId: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      aria-label={pinned ? "Unpin" : "Pin"}
      disabled={pending}
      onClick={() => start(async () => { await togglePinAffiliate(affiliateId, !pinned); router.refresh(); })}
      className="text-muted-foreground/40 transition-colors hover:text-amber-500"
    >
      <Star className={cn("h-4 w-4", pinned && "fill-amber-400 text-amber-400")} />
    </button>
  );
}
