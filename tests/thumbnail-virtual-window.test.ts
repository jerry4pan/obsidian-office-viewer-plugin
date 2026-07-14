import { computeThumbnailWindow } from "../src/thumbnail-virtual-window";

describe("computeThumbnailWindow", () => {
  const common = {
    itemHeight: 110,
    viewportHeight: 550,
    overscanViewports: 1,
  };

  const cases: Array<[
    number,
    number,
    { start: number; endExclusive: number; offsetTop: number; totalHeight: number },
  ]> = [
    [100, 0, { start: 0, endExclusive: 10, offsetTop: 0, totalHeight: 11_000 }],
    [100, 50, { start: 45, endExclusive: 60, offsetTop: 4_950, totalHeight: 11_000 }],
    [100, 95, { start: 90, endExclusive: 100, offsetTop: 9_900, totalHeight: 11_000 }],
    [200, 0, { start: 0, endExclusive: 10, offsetTop: 0, totalHeight: 22_000 }],
    [200, 80, { start: 75, endExclusive: 90, offsetTop: 8_250, totalHeight: 22_000 }],
    [200, 195, { start: 190, endExclusive: 200, offsetTop: 20_900, totalHeight: 22_000 }],
  ];

  for (const [itemCount, firstVisible, expected] of cases) {
    it(`bounds a ${itemCount}-slide deck around slide ${firstVisible}`, () => {
      const window = computeThumbnailWindow({
        ...common,
        itemCount,
        scrollTop: common.itemHeight * firstVisible,
      });

      expect(window).toEqual(expected);
      expect(window.endExclusive - window.start).toBeLessThanOrEqual(15);
      expect(window.endExclusive - window.start).toBeLessThan(itemCount);
    });
  }

  it("uses ceil for partially visible items and proportional overscan", () => {
    expect(
      computeThumbnailWindow({
        itemCount: 100,
        itemHeight: 100,
        scrollTop: 250,
        viewportHeight: 225,
        overscanViewports: 1.5,
      }),
    ).toEqual({ start: 0, endExclusive: 9, offsetTop: 0, totalHeight: 10_000 });
  });

  it("returns an empty finite window for no items or invalid item height", () => {
    expect(
      computeThumbnailWindow({
        itemCount: 0,
        itemHeight: 110,
        scrollTop: 10,
        viewportHeight: 550,
        overscanViewports: 1,
      }),
    ).toEqual({ start: 0, endExclusive: 0, offsetTop: 0, totalHeight: 0 });
    expect(
      computeThumbnailWindow({
        itemCount: 100,
        itemHeight: Number.NaN,
        scrollTop: Number.POSITIVE_INFINITY,
        viewportHeight: 550,
        overscanViewports: 1,
      }),
    ).toEqual({ start: 0, endExclusive: 0, offsetTop: 0, totalHeight: 0 });
  });

  it("normalizes fractional counts and clamps hostile scroll and sizing inputs", () => {
    expect(
      computeThumbnailWindow({
        itemCount: 10.9,
        itemHeight: 100,
        scrollTop: Number.POSITIVE_INFINITY,
        viewportHeight: -20,
        overscanViewports: -1,
      }),
    ).toEqual({ start: 9, endExclusive: 10, offsetTop: 900, totalHeight: 1_000 });

    const result = computeThumbnailWindow({
      itemCount: 200,
      itemHeight: 110,
      scrollTop: Number.NaN,
      viewportHeight: Number.POSITIVE_INFINITY,
      overscanViewports: Number.POSITIVE_INFINITY,
    });
    expect(result).toEqual({ start: 0, endExclusive: 1, offsetTop: 0, totalHeight: 22_000 });
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });
});
