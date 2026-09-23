import { describe, expect, it } from "vitest";
import { generateStrongPassword } from "./password";

describe("generateStrongPassword", () => {
  it("always satisfies the server password policy", () => {
    for (let i = 0; i < 500; i++) {
      const p = generateStrongPassword();
      expect(p).toHaveLength(14);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[\W_]/);
    }
  });
});
