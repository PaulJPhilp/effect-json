import { Effect, Either, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
  parseBatch,
  parseStream,
  stringifyBatch,
  stringifyStream,
} from "../../../backends/jsonLines.js";
import { JsonLinesParseError } from "../../../errors.js";

describe("jsonLines backend", () => {
  describe("parseBatch", () => {
    it("should parse single-line JSONL", async () => {
      const input = '{"id":1,"name":"Alice"}\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ id: 1, name: "Alice" }]);
    });

    it("should parse multi-line JSONL", async () => {
      const input = '{"id":1}\n{"id":2}\n{"id":3}\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("should handle CRLF line endings", async () => {
      const input = '{"id":1}\r\n{"id":2}\r\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should skip blank lines", async () => {
      const input = '{"id":1}\n\n{"id":2}\n  \n{"id":3}\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("should return empty array for empty input", async () => {
      const effect = parseBatch("");
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([]);
    });

    it("should return empty array for only blank lines", async () => {
      const effect = parseBatch("\n  \n\t\n");
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([]);
    });

    it("should fail with JsonLinesParseError on invalid JSON", async () => {
      const input = '{"id":1}\n{invalid json}\n{"id":3}\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(JsonLinesParseError);
        expect(error.lineNumber).toBe(2);
        expect(error.message).toContain("Line 2");
      }
    });

    it("should handle Buffer input", async () => {
      const buffer = Buffer.from('{"id":1}\n{"id":2}\n');
      const effect = parseBatch(buffer);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should parse various JSON types", async () => {
      const input = '{"obj":"value"}\n[1,2,3]\n"string"\n42\ntrue\nnull\n';
      const effect = parseBatch(input);
      const result = await Effect.runPromise(effect);

      expect(result).toEqual([{ obj: "value" }, [1, 2, 3], "string", 42, true, null]);
    });
  });

  describe("stringifyBatch", () => {
    it("should stringify single object", async () => {
      const values = [{ id: 1, name: "Alice" }];
      const effect = stringifyBatch(values);
      const result = await Effect.runPromise(effect);

      expect(result).toBe('{"id":1,"name":"Alice"}\n');
    });

    it("should stringify multiple objects", async () => {
      const values = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const effect = stringifyBatch(values);
      const result = await Effect.runPromise(effect);

      expect(result).toBe('{"id":1}\n{"id":2}\n{"id":3}\n');
    });

    it("should return empty string for empty array", async () => {
      const values: unknown[] = [];
      const effect = stringifyBatch(values);
      const result = await Effect.runPromise(effect);

      expect(result).toBe("");
    });

    it("should stringify various JSON types", async () => {
      const values = [{ obj: "value" }, [1, 2, 3], "string", 42, true, null];
      const effect = stringifyBatch(values);
      const result = await Effect.runPromise(effect);

      expect(result).toBe('{"obj":"value"}\n[1,2,3]\n"string"\n42\ntrue\nnull\n');
    });

    it("should handle indentation option", async () => {
      const values = [{ id: 1 }];
      const effect = stringifyBatch(values, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain("  "); // Should have indentation
      expect(result).toContain('"id"');
    });
  });

  describe("parseStream", () => {
    it("should parse stream with aligned chunks", async () => {
      const chunks = ['{"id":1}\n', '{"id":2}\n'];
      const stream = Stream.fromIterable(chunks);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should parse stream with mid-line splits", async () => {
      const chunks = ['{"id":', '1}\n{"id":2}\n'];
      const stream = Stream.fromIterable(chunks);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should parse stream with arbitrary splits", async () => {
      const chunks = ['{"id', '":', '"val', 'ue"}\n', '{"id2":"v2"}\n'];
      const stream = Stream.fromIterable(chunks);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual([{ id: "value" }, { id2: "v2" }]);
    });

    it("should skip blank lines in stream", async () => {
      const chunks = ['{"id":1}\n', "\n  \n", '{"id":2}\n'];
      const stream = Stream.fromIterable(chunks);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("should emit empty stream for empty input", async () => {
      const stream = Stream.fromIterable([""]);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(parsed));

      expect(Array.from(result)).toEqual([]);
    });

    it("should fail with JsonLinesParseError on invalid JSON in stream", async () => {
      const chunks = ['{"id":1}\n', "{invalid}\n"];
      const stream = Stream.fromIterable(chunks);
      const parsed = parseStream(stream);
      const result = await Effect.runPromise(Effect.either(Stream.runCollect(parsed)));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        const error = result.left;
        expect(error).toBeInstanceOf(JsonLinesParseError);
        expect(error.lineNumber).toBe(2);
      }
    });
  });

  describe("stringifyStream", () => {
    it("should stringify single value stream", async () => {
      const stream = Stream.fromIterable([{ id: 1 }]);
      const stringified = stringifyStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(stringified));

      expect(Array.from(result)).toEqual(['{"id":1}\n']);
    });

    it("should stringify multiple values stream", async () => {
      const stream = Stream.fromIterable([{ id: 1 }, { id: 2 }, { id: 3 }]);
      const stringified = stringifyStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(stringified));

      expect(Array.from(result)).toEqual(['{"id":1}\n', '{"id":2}\n', '{"id":3}\n']);
    });

    it("should emit nothing for empty stream", async () => {
      const stream = Stream.fromIterable([]);
      const stringified = stringifyStream(stream);
      const result = await Effect.runPromise(Stream.runCollect(stringified));

      expect(Array.from(result)).toEqual([]);
    });
  });
});
