import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption.js";

describe("encryption", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "ghu_realGitHubTokenLookingString123";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-input");
    expect(decrypt(b)).toBe("same-input");
  });
});
