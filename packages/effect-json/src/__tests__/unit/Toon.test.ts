import { Effect, Either, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { parseToon, stringifyToon } from "../../Toon.js";
import { ValidationError } from "../../errors.js";

describe("Toon", () => {
  const User = Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    tags: Schema.Array(Schema.String),
  });

  type User = Schema.Schema.Type<typeof User>;

  const user: User = {
    id: 1,
    name: "Alice",
    tags: ["admin", "beta"],
  };

  describe("round trip", () => {
    it("should stringify and parse back to original value", async () => {
      const program = Effect.gen(function* () {
        const toon = yield* stringifyToon(User, user);
        const decoded = yield* parseToon(User, toon);
        return decoded;
      });

      const result = await Effect.runPromise(program);
      expect(result).toEqual(user);
    });
  });

  describe("validation", () => {
    it("should fail validation if TOON content doesn't match schema", async () => {
      // Create a TOON string that represents valid data but wrong schema
      // e.g. missing 'tags'
      const invalidUser = { id: 1, name: "Alice" };
      // We use stringifyToon with a looser schema to generate the TOON string
      const PartialUser = Schema.Struct({
        id: Schema.Number,
        name: Schema.String,
      });
      
      const program = Effect.gen(function* () {
        const toon = yield* stringifyToon(PartialUser, invalidUser);
        // Now try to parse with full User schema
        return yield* parseToon(User, toon);
      });

      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Schema validation failed");
      }
    });

    it("should fail validation before stringify if value doesn't match schema", async () => {
      const invalidUser = { id: 1, name: "Alice" } as unknown as User;
      
      const program = stringifyToon(User, invalidUser);
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Validation failed before stringify");
      }
    });
  });

  describe("syntax errors", () => {
    it("should return ValidationError for invalid TOON structure", async () => {
      // TOON parses "[" as an array, which doesn't match User schema
      const program = parseToon(User, "[");
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        // Since TOON successfully parses it as an array, we expect a ValidationError
        // because it doesn't match the User schema
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Schema validation failed");
      }
    });
  });
});
