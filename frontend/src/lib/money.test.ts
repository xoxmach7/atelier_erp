import { describe, it, expect } from "vitest";
import { fmtMoney, fmtDigits } from "./money";

describe("fmtMoney", () => {
  it("не раздувает Decimal-строку бэкенда в 100 раз", () => {
    // Регрессия: вырезание нецифровых символов съедало точку и
    // «35000.00» превращалось в «3 500 000».
    expect(fmtMoney("35000.00")).toBe("35 000");
    expect(fmtMoney("110024.50")).toBe("110 025");
  });

  it("принимает число", () => {
    expect(fmtMoney(66750)).toBe("66 750");
    expect(fmtMoney(0)).toBe("0");
  });

  it("пустое и мусор дают 0", () => {
    expect(fmtMoney(null)).toBe("0");
    expect(fmtMoney(undefined)).toBe("0");
    expect(fmtMoney("")).toBe("0");
    expect(fmtMoney("abc")).toBe("0");
  });
});

describe("fmtDigits", () => {
  it("разбивает разряды в вводе пользователя", () => {
    expect(fmtDigits("35000")).toBe("35 000");
    expect(fmtDigits("1234567")).toBe("1 234 567");
  });
});
