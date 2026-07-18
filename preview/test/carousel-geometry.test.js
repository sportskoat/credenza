import { describe, expect, it } from "vitest";
import {
  carouselForegroundWithHysteresis,
  carouselLayerZ,
  findNearestCarouselIndex,
} from "../../credenza-fashion.jsx";

describe("carousel geometry", () => {
  const centers = [400, 580, 770, 955];

  it("finds the nearest card in content coordinates that do not begin at zero", () => {
    expect(findNearestCarouselIndex(centers, 401)).toBe(0);
    expect(findNearestCarouselIndex(centers, 590)).toBe(1);
    expect(findNearestCarouselIndex(centers, 930)).toBe(3);
  });

  it("holds foreground ownership inside the midpoint hysteresis band", () => {
    const midpoint = (centers[0] + centers[1]) / 2;
    expect(carouselForegroundWithHysteresis(centers, 0, midpoint + 10)).toBe(0);
    expect(carouselForegroundWithHysteresis(centers, 0, midpoint + 20)).toBe(1);
    expect(carouselForegroundWithHysteresis(centers, 1, midpoint - 10)).toBe(1);
    expect(carouselForegroundWithHysteresis(centers, 1, midpoint - 20)).toBe(0);
  });

  it("supports uneven spacing and can cross more than one card in a fast movement", () => {
    expect(carouselForegroundWithHysteresis(centers, 0, 900)).toBe(3);
    expect(carouselForegroundWithHysteresis(centers, 3, 420)).toBe(0);
  });

  it("gives the foreground the top layer and resolves equal-distance ties deterministically", () => {
    const foregroundZ = carouselLayerZ(5, 2, 2);
    const leftZ = carouselLayerZ(5, 1, 2);
    const rightZ = carouselLayerZ(5, 3, 2);
    expect(foregroundZ).toBeGreaterThan(leftZ);
    expect(leftZ).toBeGreaterThan(rightZ);
  });
});
