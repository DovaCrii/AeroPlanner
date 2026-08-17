/**
 * Battery budgeting and mission splitting.
 *
 * Deliberately takes no default endurance. The manufacturer's hover figure is
 * a laboratory number; the value that decides whether a crew flies is a policy
 * of the operation, set against its own wind, temperature and battery age.
 * Inventing one here would turn a safety check into an obstacle that someone
 * eventually switches off.
 */

/** Endurance policy — supplied by the operation, never guessed. */
export interface EndurancePolicy {
  /**
   * Minutes of usable flight per battery under real conditions. Lower than
   * the manufacturer's hover endurance.
   */
  operationalEnduranceMin: number;
  /** Minutes held back as reserve, never planned into a flight. */
  reserveMin: number;
}

export interface FlightLeg {
  /** 1-based ordinal of this leg. */
  index: number;
  durationS: number;
}

export interface BatteryPlan {
  /** Minutes actually plannable per battery, after the reserve. */
  usableMinPerBattery: number;
  /** How many batteries the mission consumes. */
  batteriesNeeded: number;
  /** Whether the mission fits in a single flight. */
  fitsInOneFlight: boolean;
  /** Even split of the mission across the required flights. */
  legs: FlightLeg[];
  /** Fraction of the last battery consumed, 0–1. */
  lastBatteryUsedFraction: number;
}

const SECONDS_PER_MINUTE = 60;

/**
 * Works out how many batteries a mission needs, and splits it evenly.
 *
 * The split is even by design: cutting the mission into a full flight plus a
 * three-minute stub is legal arithmetic but poor operations — nobody wants to
 * swap a battery for a two-line remainder.
 */
export function planBatteries(
  missionDurationS: number,
  policy: EndurancePolicy,
): BatteryPlan {
  const { operationalEnduranceMin, reserveMin } = policy;

  if (!Number.isFinite(missionDurationS) || missionDurationS < 0) {
    throw new RangeError(
      `missionDurationS must be a non-negative number, got ${missionDurationS}`,
    );
  }

  const usableMinPerBattery = operationalEnduranceMin - reserveMin;
  if (usableMinPerBattery <= 0) {
    throw new RangeError(
      `Reserve (${reserveMin} min) leaves no usable flight time out of ` +
        `${operationalEnduranceMin} min of endurance`,
    );
  }

  const usableS = usableMinPerBattery * SECONDS_PER_MINUTE;
  const batteriesNeeded = Math.max(1, Math.ceil(missionDurationS / usableS));

  const legDurationS = missionDurationS / batteriesNeeded;
  const legs: FlightLeg[] = Array.from({ length: batteriesNeeded }, (_, i) => ({
    index: i + 1,
    durationS: legDurationS,
  }));

  return {
    usableMinPerBattery,
    batteriesNeeded,
    fitsInOneFlight: batteriesNeeded === 1,
    legs,
    lastBatteryUsedFraction: legDurationS / usableS,
  };
}
