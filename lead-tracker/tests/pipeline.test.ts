import { describe, it, expect } from "vitest";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  stageRank,
  transitionKind,
  isBackward,
  isInPipeline,
  NEXT_STAGE,
  ageFromDob,
  type PipelineStage,
} from "@/lib/domain/pipeline";

describe("pipeline stage ordering", () => {
  it("has the six spec stages in order", () => {
    expect(PIPELINE_STAGES).toEqual([
      "qualified",
      "quote_sent",
      "negotiation",
      "application_received",
      "policy_issued",
      "renewal",
    ]);
  });

  it("ranks stages 1..6 and labels every one", () => {
    PIPELINE_STAGES.forEach((s, i) => {
      expect(stageRank(s)).toBe(i + 1);
      expect(STAGE_LABEL[s]).toBeTruthy();
    });
  });

  it("NEXT_STAGE walks forward and stops at the end", () => {
    expect(NEXT_STAGE("qualified")).toBe("quote_sent");
    expect(NEXT_STAGE("policy_issued")).toBe("renewal");
    expect(NEXT_STAGE("renewal")).toBeNull();
  });
});

describe("transitions", () => {
  it("treats a same-stage move as a no-op", () => {
    expect(transitionKind("negotiation", "negotiation")).toBeNull();
  });

  it("labels forward moves as progress", () => {
    expect(transitionKind("qualified", "quote_sent")).toBe("progress");
    expect(transitionKind("quote_sent", "policy_issued")).toBe("progress");
  });

  /**
   * The spec explicitly requires a salesperson to be able to walk a deal back
   * (Application Received -> Negotiation). It must stay legal, just recorded
   * differently — this guards against reintroducing the old admin-only block.
   */
  it("allows backward moves and records them as corrections", () => {
    expect(transitionKind("application_received", "negotiation")).toBe("correction");
    expect(isBackward("application_received", "negotiation")).toBe(true);
    expect(isBackward("negotiation", "application_received")).toBe(false);
  });

  it("marks entering and leaving the pipeline", () => {
    expect(transitionKind(null, "qualified")).toBe("qualify");
    expect(transitionKind("quote_sent", null)).toBe("disqualify");
  });

  it("never returns null for two different stages", () => {
    for (const from of PIPELINE_STAGES) {
      for (const to of PIPELINE_STAGES) {
        if (from === to) continue;
        expect(transitionKind(from, to)).not.toBeNull();
      }
    }
  });
});

describe("isInPipeline", () => {
  it("requires qualified AND active", () => {
    expect(isInPipeline("qualified", "active")).toBe(true);
    expect(isInPipeline("qualified", "lost")).toBe(false);
    expect(isInPipeline("pending", "active")).toBe(false);
    expect(isInPipeline("not_qualified", "active")).toBe(false);
  });
});

describe("ageFromDob", () => {
  it("derives age from a date of birth", () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 30);
    expect(ageFromDob(d.toISOString().slice(0, 10))).toBe(30);
  });

  it("does not count a birthday that hasn't happened yet this year", () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 30);
    d.setDate(d.getDate() + 2); // birthday is two days away
    expect(ageFromDob(d.toISOString().slice(0, 10))).toBe(29);
  });

  it("returns null for missing or unusable input", () => {
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob("")).toBeNull();
    expect(ageFromDob("not-a-date")).toBeNull();
  });
});

describe("stage labels", () => {
  it("uses the business wording, not the enum value", () => {
    const labels = PIPELINE_STAGES.map((s: PipelineStage) => STAGE_LABEL[s]);
    expect(labels).toContain("Quote Sent");
    expect(labels).toContain("Application Received");
    expect(labels).toContain("Policy Issued");
  });
});
