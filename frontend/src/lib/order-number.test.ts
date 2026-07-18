import { describe, it, expect } from "vitest";
import { shortOrderNumber } from "./order-number";

describe("shortOrderNumber", () => {
  it("сокращает автономер до хвоста", () => {
    expect(shortOrderNumber("О-2026-933")).toBe("№933");
  });

  it("не трогает свой номер ателье", () => {
    // Иначе «ЗАКАЗ-А1» превратился бы в «№1».
    expect(shortOrderNumber("ЗАКАЗ-А1")).toBe("ЗАКАЗ-А1");
    expect(shortOrderNumber("2026/07/18-Ахметов")).toBe("2026/07/18-Ахметов");
  });

  it("пустое значение отдаёт пустую строку", () => {
    expect(shortOrderNumber("")).toBe("");
    expect(shortOrderNumber(null)).toBe("");
    expect(shortOrderNumber(undefined)).toBe("");
  });
});
