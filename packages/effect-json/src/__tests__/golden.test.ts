import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Json from "../index.js";
import complexTypesFixture from "./fixtures/complex-types.js";
import configFixture from "./fixtures/config.js";
import usersFixture from "./fixtures/users.js";

describe("Golden Fixture Tests", () => {
  // User schema for user fixtures
  const UserSchema = Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    email: Schema.String,
  });

  describe("User Fixtures", () => {
    Object.entries(usersFixture).forEach(([name, fixture]) => {
      if (name.startsWith("__")) return; // Skip metadata keys

      const { data, raw_input, __metadata } = fixture as {
        data?: unknown;
        raw_input?: string;
        __metadata: {
          description: string;
          should_parse: boolean;
          should_validate: boolean;
          round_trip?: boolean;
          expected_error?: string;
          backends: string[];
        };
      };

      it(`should handle: ${name} - ${__metadata.description}`, async () => {
        const input = raw_input ?? JSON.stringify(data);

        // Test JSON backend if supported
        if (__metadata.backends.includes("json")) {
          const effect = Json.parse(UserSchema, input);
          const result = await Effect.runPromise(Effect.either(effect));

          if (__metadata.should_validate) {
            expect(result._tag).toBe("Right");
            if (result._tag === "Right" && __metadata.round_trip !== false) {
              // Round-trip test
              const stringified = await Effect.runPromise(Json.stringify(UserSchema, result.right));
              const reparsed = await Effect.runPromise(Json.parse(UserSchema, stringified));
              expect(reparsed).toEqual(result.right);
            }
          } else {
            expect(result._tag).toBe("Left");
            if (result._tag === "Left" && __metadata.expected_error) {
              expect(result.left._tag).toBe(__metadata.expected_error);
            }
          }
        }

        // Test JSONC backend if supported
        if (__metadata.backends.includes("jsonc")) {
          const effect = Json.parseJsonc(UserSchema, input);
          const result = await Effect.runPromise(Effect.either(effect));

          if (__metadata.should_validate) {
            expect(result._tag).toBe("Right");
            if (result._tag === "Right" && __metadata.round_trip !== false) {
              // Round-trip test (stringify to JSON)
              const stringified = await Effect.runPromise(Json.stringify(UserSchema, result.right));
              const reparsed = await Effect.runPromise(Json.parse(UserSchema, stringified));
              expect(reparsed).toEqual(result.right);
            }
          } else {
            expect(result._tag).toBe("Left");
          }
        }
      });
    });
  });

  describe("Complex Types Fixtures (SuperJSON)", () => {
    Object.entries(complexTypesFixture).forEach(([name, fixture]) => {
      if (name.startsWith("__")) return;

      const { data, __metadata } = fixture as {
        data?: unknown;
        __metadata: {
          description: string;
          should_parse: boolean;
          should_validate: boolean;
          round_trip?: boolean;
          backends: string[];
          schema_type?: string;
        };
      };

      it(`should handle: ${name} - ${__metadata.description}`, async () => {
        if (!__metadata.backends.includes("superjson")) return;

        // For SuperJSON tests, we'll use a more permissive schema
        // In real usage, you'd define specific schemas for each type
        const GenericSchema = Schema.Struct({
          id: Schema.Number,
        });

        if (data) {
          const stringified = await Effect.runPromise(
            Effect.either(Json.stringifySuperjson(GenericSchema, data as never)),
          );

          if (__metadata.should_validate) {
            expect(stringified._tag).toBe("Right");

            if (stringified._tag === "Right" && __metadata.round_trip !== false) {
              // Round-trip test
              const reparsed = await Effect.runPromise(
                Effect.either(Json.parseSuperjson(GenericSchema, stringified.right)),
              );
              expect(reparsed._tag).toBe("Right");
            }
          } else {
            expect(stringified._tag).toBe("Left");
          }
        }
      });
    });
  });

  describe("Config Fixtures (JSONC)", () => {
    Object.entries(configFixture).forEach(([name, fixture]) => {
      if (name.startsWith("__")) return;

      const { data, raw_input, __metadata } = fixture as {
        data?: unknown;
        raw_input?: string;
        __metadata: {
          description: string;
          should_parse: boolean;
          should_validate: boolean;
          round_trip?: boolean;
          expected_error?: string;
          backends: string[];
        };
      };

      it(`should handle: ${name} - ${__metadata.description}`, async () => {
        if (!__metadata.backends.includes("jsonc")) return;

        // Use a generic schema for config parsing
        const ConfigSchema = Schema.Unknown;

        const input = raw_input ?? JSON.stringify(data);
        const effect = Json.parseJsonc(ConfigSchema, input);
        const result = await Effect.runPromise(Effect.either(effect));

        if (__metadata.should_parse) {
          if (__metadata.should_validate) {
            expect(result._tag).toBe("Right");

            if (result._tag === "Right" && __metadata.round_trip !== false) {
              // Round-trip test
              const stringified = await Effect.runPromise(
                Json.stringify(ConfigSchema, result.right),
              );
              const reparsed = await Effect.runPromise(Json.parse(ConfigSchema, stringified));
              expect(reparsed).toEqual(result.right);
            }
          }
        } else {
          expect(result._tag).toBe("Left");
          if (result._tag === "Left" && __metadata.expected_error) {
            expect(result.left._tag).toBe(__metadata.expected_error);
          }
        }
      });
    });
  });

  describe("Round-trip Guarantees", () => {
    it("should guarantee round-trip for valid user (JSON)", async () => {
      const original = { id: 1, name: "Paul", email: "paul@example.com" };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const stringified = yield* Json.stringify(UserSchema, original);
          const reparsed = yield* Json.parse(UserSchema, stringified);
          return { original, reparsed };
        }),
      );

      expect(result.original).toEqual(result.reparsed);
    });

    it("should guarantee round-trip for JSONC (comments stripped)", async () => {
      const jsonc = `
{
  // Comment
  "id": 1,
  "name": "Paul",
  "email": "paul@example.com"
}
`;

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const parsed = yield* Json.parseJsonc(UserSchema, jsonc);
          const stringified = yield* Json.stringify(UserSchema, parsed);
          const reparsed = yield* Json.parse(UserSchema, stringified);
          return { parsed, reparsed };
        }),
      );

      expect(result.parsed).toEqual(result.reparsed);
    });

    it("should guarantee round-trip for SuperJSON with Date", async () => {
      const ComplexSchema = Schema.Struct({
        id: Schema.Number,
        createdAt: Schema.DateFromSelf,
      });

      const original = {
        id: 1,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      };

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const stringified = yield* Json.stringifySuperjson(ComplexSchema, original);
          const reparsed = yield* Json.parseSuperjson(ComplexSchema, stringified);
          return { original, reparsed };
        }),
      );

      expect(result.reparsed.id).toBe(original.id);
      expect(result.reparsed.createdAt).toBeInstanceOf(Date);
      expect(result.reparsed.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    });
  });
});
