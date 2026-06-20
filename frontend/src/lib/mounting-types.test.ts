import { describe, it, expect } from "vitest";
import { getMountingTypeLabel, MOUNTING_OPTIONS } from "./mounting-types";

describe("getMountingTypeLabel", () => {
  it("известные значения → подписи", () => {
    expect(getMountingTypeLabel("cornice")).toBe("Карниз");
    expect(getMountingTypeLabel("day_night")).toBe("День-ночь (зебра)");
  });
  it("неизвестное → само значение", () => {
    expect(getMountingTypeLabel("legacy_x")).toBe("legacy_x");
  });
  it("пусто → тире", () => {
    expect(getMountingTypeLabel(null)).toBe("—");
    expect(getMountingTypeLabel("")).toBe("—");
  });
  it("8 вариантов в каталоге", () => {
    expect(MOUNTING_OPTIONS).toHaveLength(8);
  });
});
