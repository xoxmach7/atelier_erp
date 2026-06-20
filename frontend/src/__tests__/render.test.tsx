import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function StatusBadge({ label }: { label: string }) {
  return <span role="status">{label}</span>;
}

describe("RTL харнесс (jsdom)", () => {
  it("рендерит компонент", () => {
    render(<StatusBadge label="Собран" />);
    expect(screen.getByRole("status")).toHaveTextContent("Собран");
  });
});
