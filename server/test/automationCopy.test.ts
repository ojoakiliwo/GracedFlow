import { describe, expect, it } from "vitest";
import {
  AUTOMATION_COPY,
  mondayWeekIndex,
  pickAutomationCopy,
  plusDays,
  type AutomationCopyKind,
} from "../src/automationCopy.js";

const KINDS: AutomationCopyKind[] = ["sunday", "prayer", "birthday", "anniversary"];

describe("Weekly automation copy", () => {
  it("keeps twelve distinct messages for each cadence", () => {
    for (const kind of KINDS) {
      const bodies = AUTOMATION_COPY[kind].map((row) => row.body);
      const subjects = AUTOMATION_COPY[kind].map((row) => row.subject);
      expect(new Set(bodies).size).toBe(12);
      expect(new Set(subjects).size).toBe(12);
    }
  });

  it("sends a different Wednesday, Sunday and birthday text next week", () => {
    const thisWednesday = new Date("2026-09-09T06:00:00+01:00");
    const nextWednesday = new Date("2026-09-16T06:00:00+01:00");
    const thisSaturday = new Date("2026-09-12T18:00:00+01:00");
    const nextSaturday = new Date("2026-09-19T18:00:00+01:00");
    const thisBirthday = new Date("2026-09-10T07:00:00+01:00");
    const nextWeekBirthday = new Date("2026-09-17T07:00:00+01:00");

    expect(pickAutomationCopy("prayer", thisWednesday).body).not.toBe(
      pickAutomationCopy("prayer", nextWednesday).body,
    );
    expect(pickAutomationCopy("sunday", thisSaturday).body).not.toBe(
      pickAutomationCopy("sunday", nextSaturday).body,
    );
    expect(pickAutomationCopy("birthday", thisBirthday).body).not.toBe(
      pickAutomationCopy("birthday", nextWeekBirthday).body,
    );
    expect(pickAutomationCopy("anniversary", thisBirthday).body).not.toBe(
      pickAutomationCopy("anniversary", nextWeekBirthday).body,
    );
  });

  it("keeps the same copy from Monday through Sunday of one week", () => {
    const monday = new Date("2026-09-07T08:00:00+01:00");
    const sunday = new Date("2026-09-13T22:00:00+01:00");
    expect(pickAutomationCopy("birthday", monday).index).toBe(
      pickAutomationCopy("birthday", sunday).index,
    );
    expect(mondayWeekIndex(monday)).toBe(mondayWeekIndex(sunday));
  });

  it("repeats the bank after twelve weeks, not the following week", () => {
    const start = new Date("2026-09-09T06:00:00+01:00");
    const twelveWeeks = plusDays(start, 84);
    const oneWeek = plusDays(start, 7);
    expect(pickAutomationCopy("sunday", start).index).toBe(
      pickAutomationCopy("sunday", twelveWeeks).index,
    );
    expect(pickAutomationCopy("sunday", start).index).not.toBe(
      pickAutomationCopy("sunday", oneWeek).index,
    );
  });

  it("personalizes with the first-name placeholder", () => {
    for (const kind of KINDS) {
      expect(AUTOMATION_COPY[kind].some((row) => row.body.includes("{{first_name}}") || row.subject.includes("{{first_name}}"))).toBe(
        true,
      );
    }
  });
});
