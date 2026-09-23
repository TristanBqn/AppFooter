import { describe, expect, it } from "vitest";
import { STEP_MILESTONES } from "@app/contracts";
import { progressToNext } from "@app/ui/format";

// Vérifie que le scaffolding (Metro, tsc, vitest) résout bien @app/contracts et @app/ui.
describe("scaffolding @app/mobile", () => {
  it("importe les constantes du contrat", () => {
    expect(STEP_MILESTONES).toEqual([5_000, 10_000, 15_000]);
  });

  it("importe la logique pure de @app/ui", () => {
    const progress = progressToNext(4_000, STEP_MILESTONES);
    expect(progress.next).toBe(5_000);
    expect(progress.remaining).toBe(1_000);
  });
});
