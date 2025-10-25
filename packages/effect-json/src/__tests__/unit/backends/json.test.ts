import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import { jsonBackend } from "../../../backends/json.js";
import { ParseError, StringifyError } from "../../../errors.js";

describe("jsonBackend", () => {
  describe("parse", () => {
    it("should parse valid JSON", async () => {
      const effect = jsonBackend.parse('{"id": 1, "name": "Paul"}');
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1, name: "Paul" });
    });

    it("should parse arrays", async () => {
      const effect = jsonBackend.parse("[1, 2, 3]");
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse primitives", async () => {
      const effectString = jsonBackend.parse('"hello"');
      const resultString = await Effect.runPromise(effectString);
      expect(resultString).toBe("hello");

      const effectNumber = jsonBackend.parse("42");
      const resultNumber = await Effect.runPromise(effectNumber);
      expect(resultNumber).toBe(42);

      const effectBoolean = jsonBackend.parse("true");
      const resultBoolean = await Effect.runPromise(effectBoolean);
      expect(resultBoolean).toBe(true);

      const effectNull = jsonBackend.parse("null");
      const resultNull = await Effect.runPromise(effectNull);
      expect(resultNull).toBe(null);
    });

    it("should handle Buffer input", async () => {
      const buffer = Buffer.from('{"id": 1}');
      const effect = jsonBackend.parse(buffer);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual({ id: 1 });
    });

    it("should return ParseError with line/column on syntax error", async () => {
      const effect = jsonBackend.parse('{"id": 1, invalid}');
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ParseError);
        expect(error.line).toBeGreaterThan(0);
        expect(error.column).toBeGreaterThan(0);
        expect(error.snippet).toContain("invalid");
      }
    });

    it("should handle empty input", async () => {
      const effect = jsonBackend.parse("");
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ParseError);
      }
    });

    it("should handle malformed JSON", async () => {
      const effect = jsonBackend.parse("{not valid json");
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ParseError);
      }
    });
  });

  describe("stringify", () => {
    it("should stringify objects without indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      expect(result).toBe('{"id":1,"name":"Paul"}');
    });

    it("should stringify objects with indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsonBackend.stringify(value, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain("\n");
      expect(result).toContain('"id"');
      expect(result).toContain('"name"');
    });

    it("should stringify arrays", async () => {
      const value = [1, 2, 3];
      const effect = jsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      expect(result).toBe("[1,2,3]");
    });

    it("should stringify primitives", async () => {
      const effectString = jsonBackend.stringify("hello");
      const resultString = await Effect.runPromise(effectString);
      expect(resultString).toBe('"hello"');

      const effectNumber = jsonBackend.stringify(42);
      const resultNumber = await Effect.runPromise(effectNumber);
      expect(resultNumber).toBe("42");

      const effectBoolean = jsonBackend.stringify(true);
      const resultBoolean = await Effect.runPromise(effectBoolean);
      expect(resultBoolean).toBe("true");

      const effectNull = jsonBackend.stringify(null);
      const resultNull = await Effect.runPromise(effectNull);
      expect(resultNull).toBe("null");
    });

    it("should detect circular references", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference
      const circular: any = { id: 1 };
      circular.self = circular;

      const effect = jsonBackend.stringify(circular);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(StringifyError);
        expect(error.reason).toBe("cycle");
      }
    });

    it("should handle undefined (converted to undefined by JSON.stringify)", async () => {
      const value = { id: 1, optional: undefined };
      const effect = jsonBackend.stringify(value);
      const result = await Effect.runPromise(effect);

      // JSON.stringify omits undefined values
      expect(result).toBe('{"id":1}');
    });
  });
});
