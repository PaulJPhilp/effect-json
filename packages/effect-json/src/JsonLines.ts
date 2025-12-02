/**
 * JSON Lines (JSONL/NDJSON) support for effect-json
 *
 * JSON Lines is a format for storing structured data where each line is a valid JSON value.
 * It's commonly used for logs, event streams, and LLM training datasets.
 *
 * This module provides both batch (array-based) and streaming APIs.
 */

import { Effect, Stream, type Schema } from "effect";
import {
    parseBatch,
    parseStream,
    stringifyBatch,
    type JsonLinesStringifyOptions
} from "./backends/jsonLines.js";
import { JsonLinesParseError, ValidationError } from "./errors.js";
import { validateAgainstSchema, validateForStringify } from "./schema.js";

export type { JsonLinesStringifyOptions };

/**
 * Parse JSON Lines string with schema validation
 *
 * Parses a string containing newline-delimited JSON values into an array.
 * Skips blank lines. Fails on first parse or validation error.
 *
 * @example
 * ```typescript
 * const Event = Schema.Struct({
 *   id: Schema.String,
 *   message: Schema.String
 * });
 *
 * const jsonl = '{"id":"1","message":"Started"}\n{"id":"2","message":"Done"}\n';
 * const events = await Effect.runPromise(parseJsonLines(Event, jsonl));
 * // events: [{ id: "1", message: "Started" }, { id: "2", message: "Done" }]
 * ```
 */
export const parseJsonLines = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: string,
): Effect.Effect<ReadonlyArray<A>, JsonLinesParseError | ValidationError, R> =>
  Effect.gen(function* () {
    const rawValues = yield* parseBatch(input);
    // Validate each value against schema
    const validated = yield* Effect.all(
      rawValues.map((raw) => validateAgainstSchema(schema, raw as I)),
      { concurrency: "unbounded" },
    );
    return validated;
  });

/**
 * Stringify values to JSON Lines string with schema validation
 *
 * Converts an iterable of values into newline-delimited JSON.
 * Each value is validated against the schema before stringification.
 *
 * @example
 * ```typescript
 * const events = [
 *   { id: "1", message: "Started" },
 *   { id: "2", message: "Done" }
 * ];
 *
 * const jsonl = await Effect.runPromise(stringifyJsonLines(Event, events));
 * // jsonl: '{"id":"1","message":"Started"}\n{"id":"2","message":"Done"}\n'
 * ```
 */
export const stringifyJsonLines = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  values: Iterable<A>,
  options?: JsonLinesStringifyOptions,
): Effect.Effect<string, ValidationError, R> =>
  Effect.gen(function* () {
    // Validate all values before stringifying
    const valuesArray = Array.from(values);
    yield* Effect.all(
      valuesArray.map((value) => validateForStringify(schema, value)),
      { concurrency: "unbounded" },
    );
    // Note: stringifyBatch can return ParseError but in practice shouldn't
    // since we're stringifying validated values. Map ParseError to ValidationError for type safety
    const result = yield* stringifyBatch(valuesArray, options).pipe(
      Effect.mapError((error) => 
        new ValidationError({
          message: error.message,
          schemaPath: "",
          expected: "valid JSON",
          actual: valuesArray,
          cause: error.cause,
        })
      )
    );
    return result;
  });

/**
 * Parse stream of JSON Lines chunks with schema validation
 *
 * Parses a stream of string chunks (which may split lines arbitrarily)
 * into a stream of validated values. Emits one value per complete JSON line.
 * Fails stream on first parse or validation error.
 *
 * @example
 * ```typescript
 * const chunks = Stream.fromIterable([
 *   '{"id":"1","message":"Started"}\n',
 *   '{"id":"2","message":"Done"}\n'
 * ]);
 *
 * const events = streamParseJsonLines(Event, chunks);
 * const collected = await Effect.runPromise(Stream.runCollect(events));
 * ```
 */
export const streamParseJsonLines = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  input: Stream.Stream<string, never, R>,
): Stream.Stream<A, JsonLinesParseError | ValidationError, R> =>
  parseStream(input).pipe(
    Stream.mapEffect((raw) => validateAgainstSchema(schema, raw as I)),
  );

/**
 * Stringify stream of values to JSON Lines with schema validation
 *
 * Converts a stream of values into a stream of JSONL strings.
 * Each value is validated and converted to a line with trailing newline.
 * Fails stream on first validation or stringify error.
 *
 * @example
 * ```typescript
 * const events = Stream.fromIterable([
 *   { id: "1", message: "Started" },
 *   { id: "2", message: "Done" }
 * ]);
 *
 * const jsonlStream = streamStringifyJsonLines(Event, events);
 * const lines = await Effect.runPromise(Stream.runCollect(jsonlStream));
 * // lines: ['{"id":"1","message":"Started"}\n', '{"id":"2","message":"Done"}\n']
 * ```
 */
export const streamStringifyJsonLines = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  values: Stream.Stream<A, never, R>,
  options?: JsonLinesStringifyOptions,
): Stream.Stream<string, ValidationError, R> =>
  values.pipe(
    Stream.mapEffect((value) =>
      Effect.gen(function* () {
        // Validate first
        yield* validateForStringify(schema, value);
        // Then stringify
        const stringified = yield* Effect.try({
          try: () => JSON.stringify(value, null, options?.indent ?? 0) + "\n",
          catch: (error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            return new ValidationError({
              message: `Failed to stringify value: ${errorMessage}`,
              schemaPath: "",
              expected: "valid JSON",
              actual: value,
              cause: error instanceof Error ? error : undefined,
            });
          },
        });
        return stringified;
      }),
    ),
  );


