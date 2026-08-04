// Kyle 2026-08-03: a slow server, a timeout, or no internet still printed
// "I could not read that photo." That blames the customer's photo for a
// failure the photo did not cause.
//
// FIX 2c adds a third sentinel beside the auth wall and the cap wall. A
// failure to REACH the reader is never a failure to READ. These pin the
// sentinels, the copy, and the one path that stays a plain "no chart".
import { describe, expect, it } from "vitest";
import {
  CHART_AUTH_REQUIRED,
  CHART_CAP_REACHED,
  CHART_HUNT_UNAVAILABLE_COPY,
  CHART_OFFLINE,
  CHART_OFFLINE_COPY,
  CHART_UNAVAILABLE,
  CHART_UNAVAILABLE_COPY,
  isChartAuthRequired,
  isChartCapReached,
  isChartOffline,
  isChartUnavailable,
} from "../../credenza-fashion.jsx";

describe("the unavailable sentinels", () => {
  it("matches both the server fault and the offline case", () => {
    expect(isChartUnavailable(CHART_UNAVAILABLE)).toBe(true);
    expect(isChartUnavailable(CHART_OFFLINE)).toBe(true);
  });

  it("narrows to offline only for the offline sentinel", () => {
    expect(isChartOffline(CHART_OFFLINE)).toBe(true);
    expect(isChartOffline(CHART_UNAVAILABLE)).toBe(false);
  });

  it("never matches a real read, an empty read, or the other two walls", () => {
    for (const other of [null, undefined, "", "S M L", {}, CHART_AUTH_REQUIRED, CHART_CAP_REACHED]) {
      expect(isChartUnavailable(other)).toBe(false);
      expect(isChartOffline(other)).toBe(false);
    }
  });

  it("keeps the three walls apart, so one never reads as another", () => {
    expect(isChartAuthRequired(CHART_UNAVAILABLE)).toBe(false);
    expect(isChartCapReached(CHART_UNAVAILABLE)).toBe(false);
    expect(isChartUnavailable(CHART_AUTH_REQUIRED)).toBe(false);
    expect(isChartUnavailable(CHART_CAP_REACHED)).toBe(false);
  });

  it("cannot be changed by anything that receives it", () => {
    expect(Object.isFrozen(CHART_UNAVAILABLE)).toBe(true);
    expect(Object.isFrozen(CHART_OFFLINE)).toBe(true);
  });
});

describe("the copy the customer reads", () => {
  it("clears the customer's photo of blame", () => {
    expect(CHART_UNAVAILABLE_COPY).toContain("Your photo is fine");
    expect(CHART_UNAVAILABLE_COPY).toContain("Try again");
    expect(CHART_UNAVAILABLE_COPY).not.toContain("could not read that photo");
  });

  it("tells an offline person the one thing that fixes it", () => {
    expect(CHART_OFFLINE_COPY).toContain("offline");
    expect(CHART_OFFLINE_COPY).toContain("Connect to the internet");
    expect(CHART_OFFLINE_COPY).not.toContain("Your photo is fine");
  });

  it("blames neither the photo nor the item when the hunt runs on its own", () => {
    // The hunt picks its own photos, so "your photo" would name a photo the
    // customer never chose. It claims nothing about the item either.
    expect(CHART_HUNT_UNAVAILABLE_COPY).toContain("may still have a chart");
    expect(CHART_HUNT_UNAVAILABLE_COPY).not.toContain("Your photo");
    expect(CHART_HUNT_UNAVAILABLE_COPY).not.toContain("No chart for this one yet");
  });

  it("writes no em dash", () => {
    expect(CHART_UNAVAILABLE_COPY).not.toContain("—");
    expect(CHART_OFFLINE_COPY).not.toContain("—");
    expect(CHART_HUNT_UNAVAILABLE_COPY).not.toContain("—");
  });
});
