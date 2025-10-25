import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Json from "../../index.js";

describe("Parse → Validate → Stringify Round-trip", () => {
  const UserSchema = Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    email: Schema.String,
  });

  describe("JSON", () => {
    it("should parse, validate, and round-trip a user", async () => {
      const input = '{"id": 1, "name": "Paul", "email": "paul@example.com"}';

      const effect = Effect.gen(function* () {
        const parsed = yield* Json.parse(UserSchema, input);
        const stringified = yield* Json.stringify(UserSchema, parsed);
        const reparsed = yield* Json.parse(UserSchema, stringified);

        return { original: parsed, roundtrip: reparsed };
      });

      const result = await Effect.runPromise(effect);

      expect(result.original).toEqual(result.roundtrip);
    });

    it("should fail on schema mismatch", async () => {
      const input = '{"id": "not-a-number", "name": "Paul", "email": "paul@example.com"}';

      const effect = Json.parse(UserSchema, input);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(Json.ValidationError);
      }
    });

    it("should fail on missing required field", async () => {
      const input = '{"id": 1, "name": "Paul"}';

      const effect = Json.parse(UserSchema, input);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(Json.ValidationError);
      }
    });

    it("should handle arrays", async () => {
      const UsersSchema = Schema.Array(UserSchema);
      const input = '[{"id": 1, "name": "Paul", "email": "paul@example.com"}]';

      const effect = Effect.gen(function* () {
        const parsed = yield* Json.parse(UsersSchema, input);
        const stringified = yield* Json.stringify(UsersSchema, parsed);
        const reparsed = yield* Json.parse(UsersSchema, stringified);

        return { original: parsed, roundtrip: reparsed };
      });

      const result = await Effect.runPromise(effect);

      expect(result.original).toEqual(result.roundtrip);
    });
  });

  describe("JSONC", () => {
    it("should parse JSONC with comments and round-trip", async () => {
      const jsonc = `
{
  // User ID
  "id": 1,
  /* User information */
  "name": "Paul",
  "email": "paul@example.com" // Contact email
}
`;

      const effect = Effect.gen(function* () {
        const parsed = yield* Json.parseJsonc(UserSchema, jsonc);
        const stringified = yield* Json.stringify(UserSchema, parsed);
        const reparsed = yield* Json.parse(UserSchema, stringified);

        return { original: parsed, roundtrip: reparsed };
      });

      const result = await Effect.runPromise(effect);

      expect(result.original).toEqual(result.roundtrip);
      expect(result.original).toEqual({
        id: 1,
        name: "Paul",
        email: "paul@example.com",
      });
    });
  });

  describe("SuperJSON", () => {
    it("should preserve Date through round-trip", async () => {
      // Use DateFromSelf for already-instantiated Date objects
      const ComplexSchema = Schema.Struct({
        id: Schema.Number,
        createdAt: Schema.DateFromSelf,
        name: Schema.String,
      });

      const original = {
        id: 1,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        name: "Paul",
      };

      const effect = Effect.gen(function* () {
        const stringified = yield* Json.stringifySuperjson(ComplexSchema, original);
        const reparsed = yield* Json.parseSuperjson(ComplexSchema, stringified);

        return reparsed;
      });

      const result = await Effect.runPromise(effect);

      expect(result.id).toBe(original.id);
      expect(result.name).toBe(original.name);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    });

    it("should validate against schema before stringify", async () => {
      const ComplexSchema = Schema.Struct({
        id: Schema.Number,
        createdAt: Schema.DateFromSelf,
      });

      const invalid = {
        id: "not-a-number",
        createdAt: new Date(),
      };

      const effect = Json.stringifySuperjson(ComplexSchema, invalid as never);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(Json.ValidationError);
      }
    });
  });

  describe("Error handling", () => {
    it("should provide detailed ParseError", async () => {
      const input = '{"id": 1, invalid}';

      const effect = Json.parse(UserSchema, input);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        const error = result.left;
        expect(error).toBeInstanceOf(Json.ParseError);
        expect(error.line).toBeGreaterThan(0);
        expect(error.column).toBeGreaterThan(0);
        expect(error.snippet).toBeTruthy();
      }
    });

    it("should provide detailed ValidationError", async () => {
      const input = '{"id": "invalid", "name": "Paul", "email": "paul@example.com"}';

      const effect = Json.parse(UserSchema, input);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        const error = result.left;
        expect(error).toBeInstanceOf(Json.ValidationError);
        expect(error.message).toContain("validation");
      }
    });

    it("should handle circular references in stringify", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference
      const circular: any = { id: 1, name: "Paul", email: "test@example.com" };
      circular.self = circular;

      const effect = Json.stringify(UserSchema, circular);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(Json.StringifyError);
      }
    });
  });
});
