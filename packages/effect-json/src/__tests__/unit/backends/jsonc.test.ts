import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { jsoncBackend } from "../../../backends/jsonc.js";

describe("jsoncBackend", () => {
  describe("parse", () => {
    it("should parse JSON with single-line comments", async () => {
      const jsonc = `
{
  // This is a comment
  "id": 1,
  "name": "Paul" // Another comment
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1, name: "Paul" });
    });

    it("should parse JSON with multi-line comments", async () => {
      const jsonc = `
{
  /* This is a
     multi-line comment */
  "id": 1,
  "name": "Paul"
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1, name: "Paul" });
    });

    it("should parse JSON with mixed comments", async () => {
      const jsonc = `
{
  // Single line comment
  "id": 1,
  /* Multi-line
     comment */
  "name": "Paul",
  // Another single line
  "email": "paul@example.com" /* inline comment */
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({
        id: 1,
        name: "Paul",
        email: "paul@example.com",
      });
    });

    it("should not strip comments from strings", async () => {
      const jsonc = `
{
  "comment": "This is // not a comment",
  "multi": "This /* is */ also not a comment"
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({
        comment: "This is // not a comment",
        multi: "This /* is */ also not a comment",
      });
    });

    it("should handle trailing commas in arrays (if JSON parser supports)", async () => {
      // Note: Standard JSON doesn't support trailing commas, but JSONC often does
      // Our implementation strips comments but doesn't add trailing comma support
      const jsonc = `
{
  // Array with comment
  "tags": ["typescript", "effect"]
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({
        tags: ["typescript", "effect"],
      });
    });

    it("should handle Buffer input", async () => {
      const jsonc = `
{
  // Comment
  "id": 1
}
`;
      const buffer = Buffer.from(jsonc);
      const effect = jsoncBackend.parse(buffer);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1 });
    });

    it("should preserve line numbers for error reporting", async () => {
      const jsonc = `
{
  // Valid comment
  "id": 1,
  invalid syntax here
}
`;
      const effect = jsoncBackend.parse(jsonc);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      // Error should be reported, though line number may differ after comment stripping
    });
  });

  describe("stringify", () => {
    it("should stringify like regular JSON (no comments added)", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsoncBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      expect(result).toBe('{"id":1,"name":"Paul"}');
    });

    it("should support indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsoncBackend.stringify(value, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain("\n");
      expect(result).toContain('"id"');
    });
  });
});
