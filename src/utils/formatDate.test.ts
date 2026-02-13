import { describe, it, expect } from "vitest";
import { formatRelativeDate, extractAuthorName } from "./formatDate.js";

describe("formatRelativeDate", () => {
  const now = new Date("2026-02-13T12:00:00Z");

  it("returns 'just now' for less than 60 seconds", () => {
    const date = new Date("2026-02-13T11:59:30Z");
    expect(formatRelativeDate(date, now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const date = new Date("2026-02-13T11:50:00Z");
    expect(formatRelativeDate(date, now)).toBe("10m ago");
  });

  it("returns hours ago", () => {
    const date = new Date("2026-02-13T10:00:00Z");
    expect(formatRelativeDate(date, now)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const date = new Date("2026-02-10T12:00:00Z");
    expect(formatRelativeDate(date, now)).toBe("3d ago");
  });

  it("returns formatted date for more than 30 days", () => {
    const date = new Date("2025-12-01T12:00:00Z");
    const result = formatRelativeDate(date, now);
    expect(result).not.toContain("ago");
  });
});

describe("extractAuthorName", () => {
  it("extracts username from ARN", () => {
    expect(
      extractAuthorName("arn:aws:iam::123456789012:user/watany"),
    ).toBe("watany");
  });

  it("extracts assumed role name", () => {
    expect(
      extractAuthorName(
        "arn:aws:sts::123456789012:assumed-role/admin/session",
      ),
    ).toBe("session");
  });

  it("returns original if no slash", () => {
    expect(extractAuthorName("unknown")).toBe("unknown");
  });
});
