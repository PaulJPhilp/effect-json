import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { superjsonBackend } from "../../../backends/superjson.js";

describe("superjsonBackend", () => {
  describe("parse", () => {
    it("should parse SuperJSON with Date", async () => {
      const superjsonString =
        '{"json":{"createdAt":"2025-01-01T00:00:00.000Z"},"meta":{"values":{"createdAt":["Date"]}}}';
      const effect = superjsonBackend.parse(superjsonString);
      const result = await Effect.runPromise(effect);

      expect(result).toHaveProperty("createdAt");
      expect((result as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
    });

    it("should parse SuperJSON with Set", async () => {
      const superjsonString =
        '{"json":{"tags":["typescript","effect"]},"meta":{"values":{"tags":["set"]}}}';
      const effect = superjsonBackend.parse(superjsonString);
      const result = await Effect.runPromise(effect);

      expect(result).toHaveProperty("tags");
      expect((result as { tags: Set<string> }).tags).toBeInstanceOf(Set);
    });

    it("should parse SuperJSON with Map", async () => {
      const superjsonString =
        '{"json":{"metadata":[["key1","value1"],["key2","value2"]]},"meta":{"values":{"metadata":["map"]}}}';
      const effect = superjsonBackend.parse(superjsonString);
      const result = await Effect.runPromise(effect);

      expect(result).toHaveProperty("metadata");
      expect((result as { metadata: Map<string, string> }).metadata).toBeInstanceOf(Map);
    });

    it("should handle plain objects (no type metadata)", async () => {
      const plainJson = '{"id": 1, "name": "Paul"}';
      const effect = superjsonBackend.parse(plainJson);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1, name: "Paul" });
    });
  });

  describe("stringify", () => {
    it("should stringify Date with type preservation", async () => {
      const value = { createdAt: new Date("2025-01-01") };
      const effect = superjsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("json");
      expect(parsed).toHaveProperty("meta");
    });

    it("should stringify Set with type preservation", async () => {
      const value = { tags: new Set(["typescript", "effect"]) };
      const effect = superjsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("json");
      expect(parsed).toHaveProperty("meta");
    });

    it("should stringify Map with type preservation", async () => {
      const value = {
        metadata: new Map([
          ["key1", "value1"],
          ["key2", "value2"],
        ]),
      };
      const effect = superjsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("json");
      expect(parsed).toHaveProperty("meta");
    });

    it("should support indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = superjsonBackend.stringify(value, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain("\n");
    });

    it("should handle plain objects", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = superjsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      expect(result).toBeTruthy();
    });
  });

  describe("round-trip", () => {
    it("should preserve Date through round-trip", async () => {
      const original = { createdAt: new Date("2025-01-01") };

      const stringified = await Effect.runPromise(superjsonBackend.stringify(original));
      const parsed = await Effect.runPromise(superjsonBackend.parse(stringified));

      expect((parsed as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
      expect((parsed as { createdAt: Date }).createdAt.toISOString()).toBe(
        original.createdAt.toISOString(),
      );
    });

    it("should preserve Set through round-trip", async () => {
      const original = { tags: new Set(["typescript", "effect"]) };

      const stringified = await Effect.runPromise(superjsonBackend.stringify(original));
      const parsed = await Effect.runPromise(superjsonBackend.parse(stringified));

      expect((parsed as { tags: Set<string> }).tags).toBeInstanceOf(Set);
      expect(Array.from((parsed as { tags: Set<string> }).tags)).toEqual(Array.from(original.tags));
    });

    it("should preserve Map through round-trip", async () => {
      const original = { metadata: new Map([["key", "value"]]) };

      const stringified = await Effect.runPromise(superjsonBackend.stringify(original));
      const parsed = await Effect.runPromise(superjsonBackend.parse(stringified));

      expect((parsed as { metadata: Map<string, string> }).metadata).toBeInstanceOf(Map);
      expect(Array.from((parsed as { metadata: Map<string, string> }).metadata.entries())).toEqual(
        Array.from(original.metadata.entries()),
      );
    });
  });
});
