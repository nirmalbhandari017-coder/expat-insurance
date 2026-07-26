import { describe, it, expect } from "vitest";
import {
  transitionKind,
  isTransitionAllowed,
  allowedTransitions,
  isCorrection,
  requiresLostReason,
  stageRank,
  PIPELINE_STATUSES,
  type LeadStatus,
} from "@/lib/domain/pipeline";

describe("stageRank", () => {
  it("ranks the five linear stages, null for terminal", () => {
    expect(stageRank("inbound")).toBe(1);
    expect(stageRank("account_open")).toBe(5);
    expect(stageRank("account_lapsed")).toBeNull();
    expect(stageRank("lost")).toBeNull();
  });
});

describe("transitionKind — legal moves", () => {
  it("forward progress including skips", () => {
    expect(transitionKind("inbound", "contacted")).toBe("progress");
    expect(transitionKind("inbound", "account_open")).toBe("progress"); // skip allowed
    expect(transitionKind("contacted", "opportunity_open")).toBe("progress");
  });
  it("to Lost from any working stage is progress", () => {
    for (const s of ["inbound", "contacted", "opportunity_open", "account_pending"] as LeadStatus[]) {
      expect(transitionKind(s, "lost")).toBe("progress");
    }
  });
  it("lapse, reinstate, reopen", () => {
    expect(transitionKind("account_open", "account_lapsed")).toBe("lapse");
    expect(transitionKind("account_lapsed", "account_open")).toBe("reinstate");
    expect(transitionKind("lost", "contacted")).toBe("reopen");
    expect(transitionKind("lost", "opportunity_open")).toBe("reopen");
  });
  it("one-step backward corrections", () => {
    expect(transitionKind("contacted", "inbound")).toBe("correction");
    expect(transitionKind("opportunity_open", "contacted")).toBe("correction");
    expect(transitionKind("account_pending", "opportunity_open")).toBe("correction");
    expect(transitionKind("account_open", "account_pending")).toBe("correction");
  });
});

describe("transitionKind — illegal moves", () => {
  it("no self-transition", () => {
    for (const s of PIPELINE_STATUSES) expect(transitionKind(s, s)).toBeNull();
  });
  it("account_open cannot go to Lost (it was a customer -> only lapse)", () => {
    expect(transitionKind("account_open", "lost")).toBeNull();
  });
  it("account_lapsed and lost cannot jump to inbound", () => {
    expect(transitionKind("account_lapsed", "inbound")).toBeNull();
    expect(transitionKind("lost", "inbound")).toBeNull();
  });
  it("multi-step backward is not allowed", () => {
    expect(transitionKind("account_open", "contacted")).toBeNull();
    expect(transitionKind("opportunity_open", "inbound")).toBeNull();
  });
  it("lost can only reopen to contacted/opportunity, not further", () => {
    expect(transitionKind("lost", "account_pending")).toBeNull();
    expect(transitionKind("lost", "account_open")).toBeNull();
  });
  it("lapsed can only reinstate to open", () => {
    expect(transitionKind("account_lapsed", "lost")).toBeNull();
    expect(transitionKind("account_lapsed", "account_pending")).toBeNull();
  });
});

describe("helpers", () => {
  it("allowedTransitions returns only legal targets", () => {
    const fromOpen = allowedTransitions("account_open");
    expect(fromOpen).toContain("account_lapsed");
    expect(fromOpen).toContain("account_pending"); // correction
    expect(fromOpen).not.toContain("lost");
    expect(fromOpen).not.toContain("inbound");
  });
  it("isCorrection / requiresLostReason", () => {
    expect(isCorrection("contacted", "inbound")).toBe(true);
    expect(isCorrection("inbound", "contacted")).toBe(false);
    expect(requiresLostReason("lost")).toBe(true);
    expect(requiresLostReason("account_open")).toBe(false);
  });
  it("isTransitionAllowed agrees with transitionKind", () => {
    expect(isTransitionAllowed("inbound", "lost")).toBe(true);
    expect(isTransitionAllowed("account_open", "lost")).toBe(false);
  });
});
