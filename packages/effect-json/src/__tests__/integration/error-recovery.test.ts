import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Json from "../../index.js";

describe("Error Recovery Patterns", () => {
  const UserSchema = Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    email: Schema.String,
  });

  const DEFAULT_USER = {
    id: 0,
    name: "Unknown",
    email: "unknown@example.com",
  };

  describe("catchTag Patterns", () => {
    it("should recover from ParseError with default value", async () => {
      const badJson = '{"id": 1, invalid}';

      const effect = Json.parse(UserSchema, badJson).pipe(
        Effect.catchTag("ParseError", (err) => {
          expect(err.line).toBeGreaterThan(0);
          expect(err.column).toBeGreaterThan(0);
          return Effect.succeed(DEFAULT_USER);
        }),
      );

      const result = await Effect.runPromise(effect);
      expect(result).toEqual(DEFAULT_USER);
    });

    it("should recover from ValidationError with logging", async () => {
      const invalidJson = '{"id": "not-a-number", "name": "Test", "email": "test@example.com"}';

      const effect = Json.parse(UserSchema, invalidJson).pipe(
        Effect.catchTag("ValidationError", (err) => {
          expect(err.message).toContain("validation");
          expect(err.schemaPath).toBeTruthy();
          return Effect.succeed(DEFAULT_USER);
        }),
      );

      const result = await Effect.runPromise(effect);
      expect(result).toEqual(DEFAULT_USER);
    });

    it("should handle StringifyError with catchTag", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing circular reference
      const circular: any = { id: 1, name: "Test", email: "test@example.com" };
      circular.self = circular;

      const effect = Json.stringify(UserSchema, circular).pipe(
        Effect.catchTag("StringifyError", (err) => {
          expect(err.reason).toBe("cycle");
          return Effect.succeed('{"id":0,"name":"fallback","email":"fallback@example.com"}');
        }),
      );

      const result = await Effect.runPromise(effect);
      expect(result).toContain("fallback");
    });

    it("should chain multiple catchTag handlers", async () => {
      const badJson = '{"id": 1, invalid}';

      const effect = Json.parse(UserSchema, badJson).pipe(
        Effect.catchTag("ValidationError", (_err) => {
          // Won't be called (this is a ParseError)
          return Effect.succeed({ ...DEFAULT_USER, name: "From ValidationError" });
        }),
        Effect.catchTag("ParseError", (err) => {
          // Will be called
          expect(err._tag).toBe("ParseError");
          return Effect.succeed({ ...DEFAULT_USER, name: "From ParseError" });
        }),
      );

      const result = await Effect.runPromise(effect);
      expect(result.name).toBe("From ParseError");
    });
  });

  describe("orElse Fallback Patterns", () => {
    it("should fallback to alternative parsing strategy", async () => {
      const badJson = '{"id": 1, invalid}';

      const primaryEffect = Json.parse(UserSchema, badJson);
      const fallbackEffect = Effect.succeed(DEFAULT_USER);

      const effect = Effect.orElse(primaryEffect, () => fallbackEffect);

      const result = await Effect.runPromise(effect);
      expect(result).toEqual(DEFAULT_USER);
    });

    it("should try multiple backends in sequence", async () => {
      const jsonc = `
{
  // Comment
  "id": 1,
  "name": "Test",
  "email": "test@example.com"
}
`;

      // JSON backend will fail on comments
      const jsonEffect = Json.parse(UserSchema, jsonc);
      // JSONC backend will succeed
      const jsoncEffect = Json.parseJsonc(UserSchema, jsonc);

      const effect = Effect.orElse(jsonEffect, () => jsoncEffect);

      const result = await Effect.runPromise(effect);
      expect(result.id).toBe(1);
      expect(result.name).toBe("Test");
    });
  });

  describe("Effect.either for Manual Handling", () => {
    it("should manually handle errors with Either", async () => {
      const badJson = '{"id": 1, invalid}';

      const effect = Json.parse(UserSchema, badJson);
      const result = await Effect.runPromise(Effect.either(effect));

      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(Json.ParseError);
        const error = result.left as Json.ParseError;
        expect(error.line).toBeGreaterThan(0);
        expect(error.column).toBeGreaterThan(0);
        expect(error.snippet).toBeTruthy();
      } else {
        throw new Error("Expected Left, got Right");
      }
    });

    it("should process successful results with Either", async () => {
      const validJson = '{"id": 1, "name": "Test", "email": "test@example.com"}';

      const effect = Json.parse(UserSchema, validJson);
      const result = await Effect.runPromise(Effect.either(effect));

      if (result._tag === "Right") {
        expect(result.right.id).toBe(1);
        expect(result.right.name).toBe("Test");
      } else {
        throw new Error("Expected Right, got Left");
      }
    });
  });

  describe("Effect.gen with Error Handling", () => {
    it("should handle errors within Effect.gen context", async () => {
      const badJson = '{"id": 1, invalid}';

      const effect = Effect.gen(function* () {
        const result = yield* Effect.either(Json.parse(UserSchema, badJson));

        if (result._tag === "Left") {
          yield* Effect.logError(`Parse failed: ${result.left.message}`);
          return DEFAULT_USER;
        }

        return result.right;
      });

      const result = await Effect.runPromise(effect);
      expect(result).toEqual(DEFAULT_USER);
    });

    it("should chain operations with error handling", async () => {
      const validJson = '{"id": 1, "name": "Test", "email": "test@example.com"}';

      const effect = Effect.gen(function* () {
        // Parse
        const parsed = yield* Json.parse(UserSchema, validJson).pipe(
          Effect.catchTag("ParseError", () => Effect.succeed(DEFAULT_USER)),
        );

        // Transform
        const updated = { ...parsed, name: parsed.name.toUpperCase() };

        // Stringify
        const stringified = yield* Json.stringify(UserSchema, updated).pipe(
          Effect.catchTag("StringifyError", () => Effect.succeed(JSON.stringify(DEFAULT_USER))),
        );

        // Re-parse to verify
        const reparsed = yield* Json.parse(UserSchema, stringified);

        return reparsed;
      });

      const result = await Effect.runPromise(effect);
      expect(result.name).toBe("TEST");
    });
  });

  describe("Retry Patterns", () => {
    it("should retry parsing with Effect.retry", async () => {
      let attempts = 0;
      const inputs = [
        '{"id": 1, invalid}',
        '{"id": 1, also invalid}',
        '{"id": 1, "name": "Test", "email": "test@example.com"}',
      ];

      const effect = Effect.gen(function* () {
        const currentInput = inputs[attempts++];
        if (!currentInput) {
          return yield* Effect.fail(
            new Json.ParseError({
              message: "No more inputs",
              line: 0,
              column: 0,
              snippet: "",
            }),
          );
        }
        return yield* Json.parse(UserSchema, currentInput);
      });

      // Note: In real usage, you'd use Effect.retry with a schedule
      // For this test, we'll just demonstrate the pattern
      const result = await Effect.runPromise(
        Effect.either(
          effect.pipe(
            Effect.catchAll(() => effect), // Try once more
            Effect.catchAll(() => effect), // Try one more time
          ),
        ),
      );

      expect(result._tag).toBe("Right");
      if (result._tag === "Right") {
        expect(result.right.id).toBe(1);
      }
    });
  });

  describe("Logging & Telemetry", () => {
    it("should log errors with Effect.tap", async () => {
      const badJson = '{"id": 1, invalid}';
      const logs: string[] = [];

      const effect = Json.parse(UserSchema, badJson).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            logs.push(`Error: ${error._tag} - ${error.message}`);
          }),
        ),
        Effect.catchAll(() => Effect.succeed(DEFAULT_USER)),
      );

      const result = await Effect.runPromise(effect);
      expect(result).toEqual(DEFAULT_USER);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain("ParseError");
    });

    it("should add context with Effect.tapError", async () => {
      const invalidJson = '{"id": "not-a-number", "name": "Test", "email": "test@example.com"}';
      const errorContext: Array<{ tag: string; path?: string }> = [];

      const effect = Json.parse(UserSchema, invalidJson).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            if (error._tag === "ValidationError") {
              errorContext.push({
                tag: error._tag,
                path: error.schemaPath,
              });
            } else {
              errorContext.push({ tag: error._tag });
            }
          }),
        ),
        Effect.catchAll(() => Effect.succeed(DEFAULT_USER)),
      );

      await Effect.runPromise(effect);
      expect(errorContext.length).toBe(1);
      expect(errorContext[0]?.tag).toBe("ValidationError");
    });
  });
});
