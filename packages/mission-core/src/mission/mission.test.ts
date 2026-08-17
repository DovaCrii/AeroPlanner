import { describe, it, expect } from "vitest";
import { planBatteries } from "./battery.js";
import { estimatePhotoCount, estimateMissionStats } from "./statistics.js";

const policy = { operationalEnduranceMin: 32, reserveMin: 8 };

describe("planBatteries", () => {
  it("fits a short mission in one battery", () => {
    const plan = planBatteries(20 * 60, policy);

    expect(plan.usableMinPerBattery).toBe(24);
    expect(plan.batteriesNeeded).toBe(1);
    expect(plan.fitsInOneFlight).toBe(true);
    expect(plan.legs).toHaveLength(1);
  });

  it("splits a mission that exceeds one battery, evenly", () => {
    // 40 min against 24 usable → two legs of 20 min, not 24 + 16.
    const plan = planBatteries(40 * 60, policy);

    expect(plan.batteriesNeeded).toBe(2);
    expect(plan.fitsInOneFlight).toBe(false);
    expect(plan.legs.map((l) => l.durationS)).toEqual([20 * 60, 20 * 60]);
  });

  it("counts the reserve as unusable", () => {
    // 30 min of mission fits in 32 min of raw endurance but NOT in the 24 min
    // that remain once the reserve is set aside.
    expect(planBatteries(30 * 60, policy).batteriesNeeded).toBe(2);
  });

  it("still needs one battery for a zero-length mission", () => {
    expect(planBatteries(0, policy).batteriesNeeded).toBe(1);
  });

  it("refuses a reserve that swallows the whole endurance", () => {
    expect(() =>
      planBatteries(600, { operationalEnduranceMin: 20, reserveMin: 20 }),
    ).toThrow(RangeError);
  });

  it("rejects a negative duration", () => {
    expect(() => planBatteries(-1, policy)).toThrow(RangeError);
  });
});

describe("estimatePhotoCount", () => {
  it("counts the shot at the start of each line", () => {
    // One 100 m line at 20 m spacing: shots at 0, 20, 40, 60, 80, 100 → six.
    const count = estimatePhotoCount(
      { lineLengthTotalM: 100, lineCount: 1, turnaroundLengthTotalM: 0 },
      20,
    );
    expect(count).toBe(6);
  });

  it("scales with the number of lines", () => {
    const count = estimatePhotoCount(
      { lineLengthTotalM: 400, lineCount: 4, turnaroundLengthTotalM: 0 },
      20,
    );
    expect(count).toBe(6 * 4);
  });

  it("returns zero when there are no lines", () => {
    expect(
      estimatePhotoCount(
        { lineLengthTotalM: 0, lineCount: 0, turnaroundLengthTotalM: 0 },
        20,
      ),
    ).toBe(0);
  });

  it("rejects a non-positive spacing", () => {
    expect(() =>
      estimatePhotoCount(
        { lineLengthTotalM: 100, lineCount: 1, turnaroundLengthTotalM: 0 },
        0,
      ),
    ).toThrow(RangeError);
  });
});

describe("estimateMissionStats", () => {
  const geometry = {
    lineLengthTotalM: 4000,
    lineCount: 10,
    turnaroundLengthTotalM: 450,
    approachLengthM: 200,
  };

  it("adds up every leg of the route", () => {
    const stats = estimateMissionStats(geometry, 20, { speedMs: 10 });
    expect(stats.distanceM).toBe(4650);
    expect(stats.durationS).toBeCloseTo(465, 6);
  });

  it("charges a penalty per turn, one fewer than the lines", () => {
    const withPenalty = estimateMissionStats(geometry, 20, {
      speedMs: 10,
      turnPenaltyS: 5,
    });
    // 10 lines → 9 turns → 45 s on top of the 465 s of cruising.
    expect(withPenalty.durationS).toBeCloseTo(465 + 45, 6);
  });

  it("rejects a non-positive speed", () => {
    expect(() => estimateMissionStats(geometry, 20, { speedMs: 0 })).toThrow(
      RangeError,
    );
  });
});
