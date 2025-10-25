/**
 * Convenience API functions for effect-json
 *
 * Primary public API for parsing and stringifying JSON with schema validation
 */

import { Effect, type Schema } from "effect";
import { jsonBackend, jsoncBackend, superjsonBackend } from "./backends/index.js";
import type { StringifyOptions } from "./backends/types.js";
import type { ParseError, StringifyError, ValidationError } from "./errors.js";
import { validateAgainstSchema, validateForStringify } from "./schema.js";

/**
 * Parse JSON with schema validation
 *
 * @example
 * ```typescript
 * const UserSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 * });
 *
 * const effect = parse(UserSchema, '{"id": 1, "name": "Paul"}');
 * const user = await Effect.runPromise(effect);
 * ```
 */
export const parse = <A, I>(
  schema: Schema.Schema<A, I>,
  input: string | Buffer,
): Effect.Effect<A, ParseError | ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* jsonBackend.parse(input);
    const validated = yield* validateAgainstSchema(schema, raw as I);
    return validated;
  });

/**
 * Stringify value to JSON with schema validation
 *
 * @example
 * ```typescript
 * const effect = stringify(UserSchema, { id: 1, name: "Paul" }, { indent: 2 });
 * const json = await Effect.runPromise(effect);
 * ```
 */
export const stringify = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
  options?: StringifyOptions,
): Effect.Effect<string, StringifyError | ValidationError> =>
  Effect.gen(function* () {
    // Validate value conforms to schema before stringifying
    yield* validateForStringify(schema, value);
    const result = yield* jsonBackend.stringify(value, options);
    return result;
  });

/**
 * Parse JSONC (JSON with Comments) with schema validation
 *
 * Strips single-line (//) and multi-line (/* *\/) comments before parsing
 *
 * @example
 * ```typescript
 * const jsonc = `
 * {
 *   // User ID
 *   "id": 1,
 *   "name": "Paul"
 * }
 * `;
 * const effect = parseJsonc(UserSchema, jsonc);
 * ```
 */
export const parseJsonc = <A, I>(
  schema: Schema.Schema<A, I>,
  input: string | Buffer,
): Effect.Effect<A, ParseError | ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* jsoncBackend.parse(input);
    const validated = yield* validateAgainstSchema(schema, raw as I);
    return validated;
  });

/**
 * Stringify to JSONC format
 *
 * Note: This produces plain JSON (comments are not programmatically added)
 * Comments should be manually added to JSONC files by developers
 */
export const stringifyJsonc = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
  options?: StringifyOptions,
): Effect.Effect<string, StringifyError | ValidationError> =>
  // JSONC stringify is identical to JSON (we don't inject comments)
  stringify(schema, value, options);

/**
 * Parse SuperJSON with schema validation
 *
 * Preserves type information for Date, Set, Map, BigInt, etc.
 * Requires 'superjson' to be installed as a peer dependency
 *
 * @example
 * ```typescript
 * const ComplexSchema = Schema.Struct({
 *   createdAt: Schema.Date,
 *   tags: Schema.Array(Schema.String),
 * });
 *
 * const json = '{"json":{"createdAt":"2025-01-01T00:00:00.000Z","tags":["typescript"]},"meta":{"values":{"createdAt":["Date"]}}}';
 * const effect = parseSuperjson(ComplexSchema, json);
 * const data = await Effect.runPromise(effect);
 * // data.createdAt is a Date object, not a string
 * ```
 */
export const parseSuperjson = <A, I>(
  schema: Schema.Schema<A, I>,
  input: string | Buffer,
): Effect.Effect<A, ParseError | ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* superjsonBackend.parse(input);
    const validated = yield* validateAgainstSchema(schema, raw as I);
    return validated;
  });

/**
 * Stringify value to SuperJSON format
 *
 * Preserves type information for round-trip serialization
 *
 * @example
 * ```typescript
 * const data = {
 *   createdAt: new Date("2025-01-01"),
 *   tags: ["typescript", "effect"],
 * };
 *
 * const effect = stringifySuperjson(ComplexSchema, data);
 * const json = await Effect.runPromise(effect);
 * // JSON includes metadata to preserve Date type
 * ```
 */
export const stringifySuperjson = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
  options?: StringifyOptions,
): Effect.Effect<string, StringifyError | ValidationError> =>
  Effect.gen(function* () {
    yield* validateForStringify(schema, value);
    const result = yield* superjsonBackend.stringify(value, options);
    return result;
  });
