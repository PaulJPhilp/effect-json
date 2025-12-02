import { Effect, Either, Schema, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { JsonLinesParseError, ValidationError } from "../../errors.js";
import {
  parseJsonLines,
  streamParseJsonLines,
  streamStringifyJsonLines,
  stringifyJsonLines,
} from "../../JsonLines.js";

describe("JsonLines", () => {
  const User = Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    tags: Schema.Array(Schema.String),
  });

  type User = Schema.Schema.Type<typeof User>;

  const validUsers: ReadonlyArray<User> = [
    { id: 1, name: "Alice", tags: ["admin", "beta"] },
    { id: 2, name: "Bob", tags: ["user"] },
  ];

  describe("parseJsonLines", () => {
    it("should parse valid JSONL and validate against schema", async () => {
      const jsonl =
        '{"id":1,"name":"Alice","tags":["admin","beta"]}\n{"id":2,"name":"Bob","tags":["user"]}\n';
      const program = parseJsonLines(User, jsonl);
      const result = await Effect.runPromise(program);

      expect(result).toEqual(validUsers);
    });

    it("should skip blank lines", async () => {
      const jsonl =
        '{"id":1,"name":"Alice","tags":["admin","beta"]}\n\n{"id":2,"name":"Bob","tags":["user"]}\n';
      const program = parseJsonLines(User, jsonl);
      const result = await Effect.runPromise(program);

      expect(result).toEqual(validUsers);
    });

    it("should return empty array for empty input", async () => {
      const program = parseJsonLines(User, "");
      const result = await Effect.runPromise(program);

      expect(result).toEqual([]);
    });

    it("should fail with JsonLinesParseError on invalid JSON", async () => {
      const jsonl = '{"id":1,"name":"Alice","tags":["admin"]}\n{invalid json}\n';
      const program = parseJsonLines(User, jsonl);
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(JsonLinesParseError);
        if (error._tag === "JsonLinesParseError") {
          expect(error.lineNumber).toBe(2);
        }
      }
    });

    it("should fail with ValidationError on schema mismatch", async () => {
      const jsonl =
        '{"id":1,"name":"Alice","tags":["admin"]}\n{"id":"wrong","name":"Bob","tags":[]}\n';
      const program = parseJsonLines(User, jsonl);
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Schema validation failed");
      }
    });

    it("should fail with ValidationError on missing field", async () => {
      const jsonl = '{"id":1,"name":"Alice"}\n'; // Missing tags field
      const program = parseJsonLines(User, jsonl);
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe("stringifyJsonLines", () => {
    it("should stringify and validate against schema", async () => {
      const program = stringifyJsonLines(User, validUsers);
      const result = await Effect.runPromise(program);

      expect(result).toBe(
        '{"id":1,"name":"Alice","tags":["admin","beta"]}\n{"id":2,"name":"Bob","tags":["user"]}\n',
      );
    });

    it("should return empty string for empty array", async () => {
      const program = stringifyJsonLines(User, []);
      const result = await Effect.runPromise(program);

      expect(result).toBe("");
    });

    it("should fail validation before stringify if value doesn't match schema", async () => {
      const invalidUser = {
        id: 1,
        name: "Alice",
      } as unknown as User;
      const program = stringifyJsonLines(User, [invalidUser]);
      const result = await Effect.runPromise(Effect.either(program));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Validation failed before stringify");
      }
    });
  });

  describe("round-trip", () => {
    it("should stringify and parse back to original value", async () => {
      const program = Effect.gen(function* () {
        const jsonl = yield* stringifyJsonLines(User, validUsers);
        const parsed = yield* parseJsonLines(User, jsonl);
        return parsed;
      });

      const result = await Effect.runPromise(program);
      expect(result).toEqual(validUsers);
    });

    it("should round-trip with various types", async () => {
      const Event = Schema.Struct({
        id: Schema.String,
        timestamp: Schema.Number,
        data: Schema.Unknown,
      });

      const events = [
        { id: "e1", timestamp: 1000, data: { key: "value" } },
        { id: "e2", timestamp: 2000, data: [1, 2, 3] },
        { id: "e3", timestamp: 3000, data: "string" },
      ];

      const program = Effect.gen(function* () {
        const jsonl = yield* stringifyJsonLines(Event, events);
        const parsed = yield* parseJsonLines(Event, jsonl);
        return parsed;
      });

      const result = await Effect.runPromise(program);
      expect(result).toEqual(events);
    });
  });

  describe("streamParseJsonLines", () => {
    it("should parse stream of chunks with validation", async () => {
      const chunks = [
        '{"id":1,"name":"Alice","tags":["admin","beta"]}\n',
        '{"id":2,"name":"Bob","tags":["user"]}\n',
      ];
      const stream = Stream.fromIterable(chunks);
      const parsed = streamParseJsonLines(User, stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual(validUsers);
    });

    it("should parse stream with mid-line splits", async () => {
      const chunks = [
        '{"id":1,"name":"Alice","tags":["admin',
        '","beta"]}\n{"id":2,"name":"Bob","tags":["user"]}\n',
      ];
      const stream = Stream.fromIterable(chunks);
      const parsed = streamParseJsonLines(User, stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual(validUsers);
    });

    it("should fail with JsonLinesParseError on invalid JSON in stream", async () => {
      const chunks = ['{"id":1,"name":"Alice","tags":[]}\n', "{invalid}\n"];
      const stream = Stream.fromIterable(chunks);
      const parsed = streamParseJsonLines(User, stream);
      const result = await Effect.runPromise(Effect.either(Stream.runCollect(parsed)));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(JsonLinesParseError);
      }
    });

    it("should fail with ValidationError on schema mismatch in stream", async () => {
      const chunks = [
        '{"id":1,"name":"Alice","tags":[]}\n',
        '{"id":"wrong","name":"Bob","tags":[]}\n',
      ];
      const stream = Stream.fromIterable(chunks);
      const parsed = streamParseJsonLines(User, stream);
      const result = await Effect.runPromise(Effect.either(Stream.runCollect(parsed)));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe("streamStringifyJsonLines", () => {
    it("should stringify stream of values with validation", async () => {
      const stream = Stream.fromIterable(validUsers);
      const stringified = streamStringifyJsonLines(User, stream);
      const result = await Effect.runPromise(Stream.runCollect(stringified));

      expect(Array.from(result)).toEqual([
        '{"id":1,"name":"Alice","tags":["admin","beta"]}\n',
        '{"id":2,"name":"Bob","tags":["user"]}\n',
      ]);
    });

    it("should emit nothing for empty stream", async () => {
      const stream = Stream.fromIterable<User>([]);
      const stringified = streamStringifyJsonLines(User, stream);
      const result = await Effect.runPromise(Stream.runCollect(stringified));

      expect(Array.from(result)).toEqual([]);
    });

    it("should fail with ValidationError on schema mismatch in stream", async () => {
      const invalidUser = { id: 1, name: "Alice" } as unknown as User;
      const stream = Stream.fromIterable([invalidUser]);
      const stringified = streamStringifyJsonLines(User, stream);
      const result = await Effect.runPromise(Effect.either(Stream.runCollect(stringified)));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain("Validation failed before stringify");
      }
    });
  });

  describe("streaming round-trip", () => {
    it("should stringify and parse streams to get original values", async () => {
      const program = Effect.gen(function* () {
        const inputStream = Stream.fromIterable(validUsers);
        const stringified = streamStringifyJsonLines(User, inputStream);
        // Since stringified has error type ValidationError, we need to handle it
        // Use mapError to convert it to never (won't actually error in success case)
        const cleanStringified = stringified.pipe(
          Stream.mapError(() => {
            throw new Error("Unexpected stringify error");
          }),
        );
        const parsed = streamParseJsonLines(User, cleanStringified);
        const collected = yield* Stream.runCollect(parsed);
        return Array.from(collected);
      });

      const result = await Effect.runPromise(program);
      expect(result).toEqual(validUsers);
    });
  });
});
