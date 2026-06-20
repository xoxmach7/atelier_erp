import { describe, it, expect } from "vitest";
import { getListStatus, getCoarseStatus, LIST_STATUS_DISPLAY } from "./list-status";

describe("getListStatus (укрупнённый статус)", () => {
  it("overdue → overdue", () => expect(getListStatus("overdue")).toBe("overdue"));
  it("completed/cancelled → done", () => {
    expect(getListStatus("completed")).toBe("done");
    expect(getListStatus("cancelled")).toBe("done");
  });
  it("new/draft/waiting_final_payment → waiting", () => {
    expect(getListStatus("new")).toBe("waiting");
    expect(getListStatus("draft")).toBe("waiting");
    expect(getListStatus("waiting_final_payment")).toBe("waiting");
  });
  it("остальные → active", () => {
    expect(getListStatus("in_work")).toBe("active");
    expect(getListStatus("in_production")).toBe("active");
    expect(getListStatus("ready")).toBe("active");
  });
});

describe("getCoarseStatus (подпись+цвет)", () => {
  it("new → Ожидание жёлтый", () => {
    expect(getCoarseStatus("new")).toEqual({ label: "Ожидание", color: "#EBDD1D" });
  });
  it("in_work → В работе зелёный", () => {
    expect(getCoarseStatus("in_work")).toEqual({ label: "В работе", color: "#32ED51" });
  });
  it("overdue красный из карты", () => {
    expect(LIST_STATUS_DISPLAY.overdue.color).toBe("#DC2626");
  });
});
