import { describe, it, expect } from "vitest";
import { formatPhone, maskPhoneInput } from "./phone";

describe("formatPhone (отображение)", () => {
  it("форматирует 11 цифр с 7", () => {
    expect(formatPhone("77001234567")).toBe("+7 (700) 123-45-67");
  });
  it("нормализует ведущую 8 → 7", () => {
    expect(formatPhone("87001234567")).toBe("+7 (700) 123-45-67");
  });
  it("добавляет 7 к 10 цифрам", () => {
    expect(formatPhone("7001234567")).toBe("+7 (700) 123-45-67");
  });
  it("пусто → тире", () => {
    expect(formatPhone("")).toBe("—");
    expect(formatPhone(null)).toBe("—");
  });
  it("нераспознанное возвращает как есть", () => {
    expect(formatPhone("abc")).toBe("abc");
  });
});

describe("maskPhoneInput (маска ввода)", () => {
  it("полный номер форматируется", () => {
    expect(maskPhoneInput("77001234567")).toBe("+7 (700) 123-45-67");
  });
  it("8 → 7", () => {
    expect(maskPhoneInput("87001234567")).toBe("+7 (700) 123-45-67");
  });
  it("10 цифр без кода получают +7", () => {
    expect(maskPhoneInput("9991234567")).toBe("+7 (999) 123-45-67");
  });
  it("идемпотентна на уже отформатированном", () => {
    expect(maskPhoneInput("+7 (700) 123-45-67")).toBe("+7 (700) 123-45-67");
  });
  it("пусто → пусто", () => {
    expect(maskPhoneInput("")).toBe("");
    expect(maskPhoneInput("abc")).toBe("");
  });
});
