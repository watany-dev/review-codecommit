import { describe, expect, it } from "vitest";
import {
  buildDisplayLines,
  COMMENT_LINE_TYPES,
  computeSimpleDiff,
  type DisplayLine,
  FOLD_THRESHOLD,
  findCommentContent,
  getCommentIdFromLine,
  getLocationFromLine,
  getReplyTargetFromLine,
} from "./displayLines.js";

describe("COMMENT_LINE_TYPES", () => {
  it("contains all four comment types", () => {
    expect(COMMENT_LINE_TYPES).toEqual([
      "inline-comment",
      "comment",
      "inline-reply",
      "comment-reply",
    ]);
  });
});

describe("FOLD_THRESHOLD", () => {
  it("is 4", () => {
    expect(FOLD_THRESHOLD).toBe(4);
  });
});

describe("getCommentIdFromLine", () => {
  it("returns commentId for comment lines", () => {
    const line: DisplayLine = { type: "comment", text: "test", commentId: "c1" };
    expect(getCommentIdFromLine(line)).toEqual({ commentId: "c1" });
  });

  it("returns commentId for inline-comment lines", () => {
    const line: DisplayLine = { type: "inline-comment", text: "test", commentId: "c2" };
    expect(getCommentIdFromLine(line)).toEqual({ commentId: "c2" });
  });

  it("returns null for non-comment lines", () => {
    const line: DisplayLine = { type: "header", text: "file.ts" };
    expect(getCommentIdFromLine(line)).toBeNull();
  });

  it("returns null when commentId is missing", () => {
    const line: DisplayLine = { type: "comment", text: "test" };
    expect(getCommentIdFromLine(line)).toBeNull();
  });
});

describe("getReplyTargetFromLine", () => {
  it("extracts author and content from comment line", () => {
    const line: DisplayLine = {
      type: "comment",
      text: "watany: LGTM",
      commentId: "c1",
    };
    const result = getReplyTargetFromLine(line);
    expect(result).toEqual({ commentId: "c1", author: "watany", content: "LGTM" });
  });

  it("extracts author from inline comment with emoji prefix", () => {
    const line: DisplayLine = {
      type: "inline-comment",
      text: "💬 taro: fix this",
      commentId: "c2",
    };
    const result = getReplyTargetFromLine(line);
    expect(result?.author).toBe("taro");
    expect(result?.content).toBe("fix this");
  });

  it("returns null for non-comment line", () => {
    const line: DisplayLine = { type: "add", text: "+new line" };
    expect(getReplyTargetFromLine(line)).toBeNull();
  });
});

describe("getLocationFromLine", () => {
  it("returns BEFORE location for delete lines", () => {
    const line: DisplayLine = {
      type: "delete",
      text: "-old",
      filePath: "src/a.ts",
      beforeLineNumber: 5,
    };
    expect(getLocationFromLine(line)).toEqual({
      filePath: "src/a.ts",
      filePosition: 5,
      relativeFileVersion: "BEFORE",
    });
  });

  it("returns AFTER location for add lines", () => {
    const line: DisplayLine = {
      type: "add",
      text: "+new",
      filePath: "src/a.ts",
      afterLineNumber: 10,
    };
    expect(getLocationFromLine(line)).toEqual({
      filePath: "src/a.ts",
      filePosition: 10,
      relativeFileVersion: "AFTER",
    });
  });

  it("returns AFTER location for context lines", () => {
    const line: DisplayLine = {
      type: "context",
      text: " same",
      filePath: "src/a.ts",
      beforeLineNumber: 3,
      afterLineNumber: 3,
    };
    expect(getLocationFromLine(line)).toEqual({
      filePath: "src/a.ts",
      filePosition: 3,
      relativeFileVersion: "AFTER",
    });
  });

  it("returns null when filePath is missing", () => {
    const line: DisplayLine = { type: "add", text: "+new", afterLineNumber: 1 };
    expect(getLocationFromLine(line)).toBeNull();
  });
});

describe("findCommentContent", () => {
  it("finds content by commentId", () => {
    const threads = [
      {
        location: null,
        comments: [{ commentId: "c1", content: "hello", authorArn: "arn:user/a" }],
      },
    ];
    expect(findCommentContent(threads, "c1")).toBe("hello");
  });

  it("returns empty string for unknown commentId", () => {
    expect(findCommentContent([], "unknown")).toBe("");
  });
});

describe("computeSimpleDiff", () => {
  it("produces context lines for identical content", () => {
    const result = computeSimpleDiff(["a", "b"], ["a", "b"]);
    expect(result).toHaveLength(2);
    expect(result[0]!.type).toBe("context");
    expect(result[1]!.type).toBe("context");
  });

  it("produces add and delete lines for changes", () => {
    const result = computeSimpleDiff(["old"], ["new"]);
    const types = result.map((l) => l.type);
    expect(types).toContain("delete");
    expect(types).toContain("add");
  });

  it("handles empty before", () => {
    const result = computeSimpleDiff([], ["a"]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("add");
  });

  it("handles empty after", () => {
    const result = computeSimpleDiff(["a"], []);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("delete");
  });
});

describe("buildDisplayLines", () => {
  it("builds lines for differences with diff texts", () => {
    const differences = [
      {
        beforeBlob: { blobId: "b1", path: "src/a.ts" },
        afterBlob: { blobId: "b2", path: "src/a.ts" },
      },
    ];
    const diffTexts = new Map([["b1:b2", { before: "old", after: "new" }]]);
    const lines = buildDisplayLines(differences, diffTexts, [], new Set(), new Map());
    expect(lines.some((l) => l.type === "header")).toBe(true);
    expect(lines.some((l) => l.type === "delete")).toBe(true);
    expect(lines.some((l) => l.type === "add")).toBe(true);
  });

  it("includes general comment threads", () => {
    const threads = [
      {
        location: null,
        comments: [{ commentId: "c1", content: "LGTM", authorArn: "arn:user/watany" }],
      },
    ];
    const lines = buildDisplayLines([], new Map(), threads, new Set(), new Map());
    expect(lines.some((l) => l.type === "comment")).toBe(true);
  });
});
