import { describe, it, expect } from "vitest";

import nextConfig from "./next.config";
import { getLegacyRedirects } from "./src/lib/legacy-redirects";

describe("next.config redirects", () => {
  it("expone la misma tabla que getLegacyRedirects()", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const rules = await nextConfig.redirects!();
    expect(rules).toEqual(getLegacyRedirects());
  });
});
