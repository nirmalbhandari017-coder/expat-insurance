import {
  STAGE_LABEL,
  STAGE_TOKEN,
  QUALIFICATION_LABEL,
  OPPORTUNITY_LABEL,
  type PipelineStage,
  type QualificationStatus,
  type OpportunityStatus,
} from "@/lib/domain/pipeline";
import { cn } from "@/lib/utils";

export function StageDot({ stage, className }: { stage: PipelineStage; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `hsl(var(--status-${STAGE_TOKEN[stage]}))` }}
    />
  );
}

export function StageBadge({ stage, className }: { stage: PipelineStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: `hsl(var(--status-${STAGE_TOKEN[stage]}))`,
        borderColor: `hsl(var(--status-${STAGE_TOKEN[stage]}) / 0.35)`,
        backgroundColor: `hsl(var(--status-${STAGE_TOKEN[stage]}) / 0.10)`,
      }}
    >
      <StageDot stage={stage} className="h-1.5 w-1.5" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** Neutral pill used for the qualification and opportunity axes. */
function Pill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: "neutral" | "good" | "bad" | "warn";
  className?: string;
}) {
  const tones: Record<typeof tone, string> = {
    neutral: "border-border bg-muted text-muted-foreground",
    good: "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    bad: "border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400",
    warn: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function QualificationBadge({
  qualification,
  className,
}: {
  qualification: QualificationStatus;
  className?: string;
}) {
  return (
    <Pill
      label={QUALIFICATION_LABEL[qualification]}
      tone={
        qualification === "qualified" ? "good" : qualification === "not_qualified" ? "bad" : "warn"
      }
      className={className}
    />
  );
}

export function OpportunityBadge({
  opportunity,
  className,
}: {
  opportunity: OpportunityStatus;
  className?: string;
}) {
  if (opportunity === "active") return null; // active is the unremarkable default
  return <Pill label={OPPORTUNITY_LABEL[opportunity]} tone="bad" className={className} />;
}
