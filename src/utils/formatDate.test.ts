import { describe, it, expect } from "vitest";
import fc from "fast-check";
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

// --- Property-Based Tests ---

// Constrain dates to a reasonable range to avoid Invalid Date from arithmetic overflow
const reasonableDate = fc.date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2030-12-31T23:59:59Z") });

describe("formatRelativeDate (property-based)", () => {
  it("always returns a non-empty string", () => {
    fc.assert(
      fc.property(reasonableDate, reasonableDate, (date, now) => {
        if (now.getTime() >= date.getTime()) {
          const result = formatRelativeDate(date, now);
          expect(result.length).toBeGreaterThan(0);
        }
      }),
    );
  });

  it("returns 'just now' for differences under 60 seconds", () => {
    fc.assert(
      fc.property(
        reasonableDate,
        fc.integer({ min: 0, max: 59 }),
        (now, diffSec) => {
          const date = new Date(now.getTime() - diffSec * 1000);
          expect(formatRelativeDate(date, now)).toBe("just now");
        },
      ),
    );
  });

  it("returns 'Nm ago' for differences between 1 and 59 minutes", () => {
    fc.assert(
      fc.property(
        reasonableDate,
        fc.integer({ min: 60, max: 3599 }),
        (now, diffSec) => {
          const date = new Date(now.getTime() - diffSec * 1000);
          const result = formatRelativeDate(date, now);
          expect(result).toMatch(/^\d+m ago$/);
        },
      ),
    );
  });

  it("returns 'Nh ago' for differences between 1 and 23 hours", () => {
    fc.assert(
      fc.property(
        reasonableDate,
        fc.integer({ min: 3600, max: 86399 }),
        (now, diffSec) => {
          const date = new Date(now.getTime() - diffSec * 1000);
          const result = formatRelativeDate(date, now);
          expect(result).toMatch(/^\d+h ago$/);
        },
      ),
    );
  });

  it("returns 'Nd ago' for differences between 1 and 29 days", () => {
    fc.assert(
      fc.property(
        reasonableDate,
        fc.integer({ min: 1, max: 29 }),
        (now, diffDays) => {
          const date = new Date(now.getTime() - diffDays * 86400 * 1000);
          const result = formatRelativeDate(date, now);
          expect(result).toMatch(/^\d+d ago$/);
        },
      ),
    );
  });

  it("result format is always one of the expected patterns", () => {
    fc.assert(
      fc.property(reasonableDate, reasonableDate, (date, now) => {
        if (now.getTime() >= date.getTime()) {
          const result = formatRelativeDate(date, now);
          const validPattern = /^(just now|\d+m ago|\d+h ago|\d+d ago|\d{1,2}\/\d{1,2}\/\d{4})$/;
          expect(result).toMatch(validPattern);
        }
      }),
    );
  });
});

describe("extractAuthorName (property-based)", () => {
  it("result equals the last segment after splitting by /", () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789:/-_"), { minLength: 1 }),
        (arn) => {
          const result = extractAuthorName(arn);
          const parts = arn.split("/");
          expect(result).toBe(parts[parts.length - 1]);
        },
      ),
    );
  });

  it("result is always a substring of the input", () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789:/-_"), { minLength: 1 }),
        (arn) => {
          const result = extractAuthorName(arn);
          expect(arn).toContain(result);
        },
      ),
    );
  });

  it("is idempotent when result has no slash", () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789:/-_"), { minLength: 1 }),
        (arn) => {
          const first = extractAuthorName(arn);
          if (!first.includes("/")) {
            expect(extractAuthorName(first)).toBe(first);
          }
        },
      ),
    );
  });

  it("returns the part after the last slash", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringOf(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 1, maxLength: 10 }),
          { minLength: 2, maxLength: 5 },
        ),
        (parts) => {
          const arn = parts.join("/");
          const result = extractAuthorName(arn);
          expect(result).toBe(parts[parts.length - 1]);
        },
      ),
    );
  });
});
