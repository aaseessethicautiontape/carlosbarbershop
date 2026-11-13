import { describe, expect, it } from "vitest";
import { guessMapping, mapRows } from "./mapping";

describe("guessMapping", () => {
  it("finds common header spellings", () => {
    expect(guessMapping(["Full Name", "Mobile", "E-mail", "Comments"])).toEqual({ name: "Full Name", phone: "Mobile", email: "E-mail", notes: "Comments" });
  });
  it("prefers first+last over a single name column", () => {
    const m = guessMapping(["First Name", "Last Name", "Name", "Phone"]);
    expect(m.first_name).toBe("First Name");
    expect(m.last_name).toBe("Last Name");
    expect(m.name).toBeUndefined();
  });
});

describe("mapRows", () => {
  const m = { first_name: "F", last_name: "L", phone: "P", email: "E" };
  it("normalises phones to E.164 and joins names", () => {
    const r = mapRows([{ F: "Mark", L: "Daniels", P: "(705) 555-0101", E: "MARK@Example.com" }], m);
    expect(r.valid).toEqual([{ name: "Mark Daniels", phone: "+17055550101", email: "mark@example.com", notes: null }]);
  });
  it("reports bad rows with line numbers (header is line 1)", () => {
    const r = mapRows([{ F: "", L: "", P: "7055550101", E: "" }, { F: "A", L: "B", P: "123", E: "" }, { F: "C", L: "D", P: "", E: "" }, { F: "E", L: "F", P: "", E: "nope" }], m);
    expect(r.valid).toHaveLength(0);
    expect(r.invalid.map((x) => x.line)).toEqual([2, 3, 4, 5]);
  });
  it("de-duplicates inside the file by phone, then email", () => {
    const r = mapRows([{ F: "A", L: "A", P: "705 555 0101", E: "" }, { F: "A2", L: "A", P: "+1 705-555-0101", E: "" }, { F: "B", L: "B", P: "", E: "b@x.ca" }, { F: "B2", L: "B", P: "", E: "B@x.ca" }], m);
    expect(r.valid).toHaveLength(2);
    expect(r.duplicates).toBe(2);
  });
});
