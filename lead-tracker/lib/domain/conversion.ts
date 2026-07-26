import type { PipelineStage } from "./pipeline";

// Counts of leads by pipeline stage (any subset; missing = 0).
export type StageCounts = Partial<Record<PipelineStage, number>>;

function n(counts: StageCounts, s: PipelineStage): number {
  return counts[s] ?? 0;
}

/** converted = reached a live policy (Policy Issued or Renewal). */
export function convertedCount(counts: StageCounts): number {
  return n(counts, "policy_issued") + n(counts, "renewal");
}

/**
 * decided = converted + lost. Lost is passed separately because in the new
 * model loss is an opportunity flag, not a stage — a lost lead still reports
 * the stage it died at.
 */
export function decidedCount(counts: StageCounts, lost = 0): number {
  return convertedCount(counts) + lost;
}

export function totalCount(counts: StageCounts, lost = 0): number {
  return (Object.values(counts) as number[]).reduce((a, b) => a + (b ?? 0), 0) + lost;
}

/**
 * Primary metric: conversion_rate = converted / decided.
 * Returns null when nothing is decided yet (avoids a misleading 0%).
 */
export function conversionRate(counts: StageCounts, lost = 0): number | null {
  const d = decidedCount(counts, lost);
  if (d === 0) return null;
  return convertedCount(counts) / d;
}

/** Guard metric: share of leads that have reached a decided state. */
export function decidedPct(counts: StageCounts, lost = 0): number | null {
  const t = totalCount(counts, lost);
  if (t === 0) return null;
  return decidedCount(counts, lost) / t;
}

/** renewal_rate = Renewal / converted — how much business we keep. */
export function renewalRate(counts: StageCounts): number | null {
  const c = convertedCount(counts);
  if (c === 0) return null;
  return n(counts, "renewal") / c;
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}
