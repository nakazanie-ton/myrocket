import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MCP Registry metadata", () => {
  it("keeps the server description within the Registry limit", () => {
    const metadata = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8")) as {
      description: string;
    };

    expect(metadata.description.length).toBeLessThanOrEqual(100);
  });
});
