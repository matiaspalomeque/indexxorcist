import { describe, expect, it } from "vitest";
import { generateCsv } from "../utils/export";

describe("generateCsv", () => {
  it("produces correct header row and data rows", () => {
    const csv = generateCsv(["Name", "Age"], [["Alice", 25], ["Bob", 30]]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Name,Age");
    expect(lines[1]).toBe("Alice,25");
    expect(lines[2]).toBe("Bob,30");
  });

  it("starts with BOM prefix", () => {
    const csv = generateCsv(["A"], [["B"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("escapes fields containing commas", () => {
    const csv = generateCsv(["Data"], [["hello, world"]]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe('"hello, world"');
  });

  it("escapes fields containing double quotes", () => {
    const csv = generateCsv(["Data"], [['say "hi"']]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe('"say ""hi"""');
  });

  it("escapes fields containing newlines", () => {
    const csv = generateCsv(["Data"], [["line1\nline2"]]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe('"line1\nline2"');
  });

  it("handles empty rows array", () => {
    const csv = generateCsv(["A", "B"], []);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("A,B");
  });

  it("handles numeric values", () => {
    const csv = generateCsv(["Count"], [[42]]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe("42");
  });
});
