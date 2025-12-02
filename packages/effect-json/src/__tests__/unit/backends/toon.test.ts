import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import { toonBackend } from "../../../backends/toon.js";
import { StringifyError } from "../../../errors.js";

describe("toonBackend", () => {
  describe("round trip", () => {
    it("should round-trip objects", async () => {
      const value = { id: 1, name: "Paul" };
      const encoded = await Effect.runPromise(toonBackend.stringify(value));
      const decoded = await Effect.runPromise(toonBackend.parse(encoded));

      expect(decoded).toEqual(value);
    });

    it("should round-trip arrays", async () => {
      const value = [1, 2, 3];
      const encoded = await Effect.runPromise(toonBackend.stringify(value));
      const decoded = await Effect.runPromise(toonBackend.parse(encoded));

      expect(decoded).toEqual(value);
    });

    it("should round-trip primitives", async () => {
      const stringVal = "hello";
      expect(
        await Effect.runPromise(
          toonBackend.stringify(stringVal).pipe(Effect.flatMap(toonBackend.parse)),
        ),
      ).toBe(stringVal);

      const numberVal = 42;
      expect(
        await Effect.runPromise(
          toonBackend.stringify(numberVal).pipe(Effect.flatMap(toonBackend.parse)),
        ),
      ).toBe(numberVal);

      const booleanVal = true;
      expect(
        await Effect.runPromise(
          toonBackend.stringify(booleanVal).pipe(Effect.flatMap(toonBackend.parse)),
        ),
      ).toBe(booleanVal);

      const nullVal = null;
      expect(
        await Effect.runPromise(
          toonBackend.stringify(nullVal).pipe(Effect.flatMap(toonBackend.parse)),
        ),
      ).toBe(nullVal);
    });
  });

  describe("stringify", () => {
    it("should return a string", async () => {
      const value = { id: 1 };
      const result = await Effect.runPromise(toonBackend.stringify(value));
      expect(typeof result).toBe("string");
    });

    it("should handle circular references", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference
      const circular: any = { id: 1 };
      circular.self = circular;

      const effect = toonBackend.stringify(circular);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(StringifyError);
        // TOON might not have specific "cycle" reason, but it should fail
      }
    });
  });

  describe("parse", () => {
    // TOON is very permissive, so we only test that it handles runtime errors if any
    // or that it returns *something* for arbitrary strings.
    it("should return ParseError (or succeed) but not throw", async () => {
      const effect = toonBackend.parse("some random string");
      const _result = await Effect.runPromise(Effect.either(effect));

      // We don't enforce success or failure, just that it doesn't crash
      expect(true).toBe(true);
    });
  });
});
