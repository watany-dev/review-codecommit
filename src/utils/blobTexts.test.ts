import type { Difference } from "@aws-sdk/client-codecommit";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/codecommit.js", () => ({
  getBlobContent: vi.fn(),
}));

import { getBlobContent } from "../services/codecommit.js";
import { fetchBlobTexts } from "./blobTexts.js";

const mockClient = {} as any;

describe("fetchBlobTexts", () => {
  it("fetches before and after blob content for each diff", async () => {
    vi.mocked(getBlobContent).mockImplementation((_client, _repo, blobId) =>
      Promise.resolve(`content-of-${blobId}`),
    );

    const diffs: Difference[] = [
      { beforeBlob: { blobId: "b1" }, afterBlob: { blobId: "a1" } },
      { beforeBlob: { blobId: "b2" }, afterBlob: { blobId: "a2" } },
    ];

    const result = await fetchBlobTexts(mockClient, "my-repo", diffs);

    expect(result.size).toBe(2);
    expect(result.get("b1:a1")).toEqual({ before: "content-of-b1", after: "content-of-a1" });
    expect(result.get("b2:a2")).toEqual({ before: "content-of-b2", after: "content-of-a2" });
  });

  it("handles missing beforeBlob (new file)", async () => {
    vi.mocked(getBlobContent).mockResolvedValue("new-content");

    const diffs: Difference[] = [{ beforeBlob: undefined, afterBlob: { blobId: "a1" } }];

    const result = await fetchBlobTexts(mockClient, "my-repo", diffs);

    expect(result.get(":a1")).toEqual({ before: "", after: "new-content" });
  });

  it("handles missing afterBlob (deleted file)", async () => {
    vi.mocked(getBlobContent).mockResolvedValue("old-content");

    const diffs: Difference[] = [{ beforeBlob: { blobId: "b1" }, afterBlob: undefined }];

    const result = await fetchBlobTexts(mockClient, "my-repo", diffs);

    expect(result.get("b1:")).toEqual({ before: "old-content", after: "" });
  });

  it("returns empty map for empty diffs", async () => {
    const result = await fetchBlobTexts(mockClient, "my-repo", []);

    expect(result.size).toBe(0);
  });
});
