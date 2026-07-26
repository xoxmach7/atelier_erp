import { describe, it, expect } from "vitest";
import { buildInventoryQrValue } from "./inventory-qr";

describe("buildInventoryQrValue", () => {
  it("формирует строку с префиксом SHEBER-INV:", () => {
    expect(buildInventoryQrValue("11111111-2222-3333-4444-555555555555")).toBe(
      "SHEBER-INV:11111111-2222-3333-4444-555555555555"
    );
  });
});
