/**
 * Experimental TOON backend for effect-json.
 *
 * TOON is a compact, human-readable encoding of the JSON data model,
 * optimized for LLM prompts and responses.
 *
 * This integration is **experimental and subject to change**
 * while the TOON specification and ecosystem continue to evolve.
 */

import { Effect, type Schema } from "effect";
import { toonBackend } from "./backends/toon.js";
import type { ParseError, StringifyError, ValidationError } from "./errors.js";
import { validateAgainstSchema, validateForStringify } from "./schema.js";

// Re-export specific options if available, or define a generic one
// For now, we'll allow any options that the backend supports
export type ToonEncodeOptions = Record<string, unknown>;

/**
 * Parse TOON string with schema validation
 *
 * @experimental
 */
export const parseToon = <A, I>(
  schema: Schema.Schema<A, I>,
  toonString: string,
): Effect.Effect<A, ParseError | ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* toonBackend.parse(toonString);
    const validated = yield* validateAgainstSchema(schema, raw as I);
    return validated;
  });

/**
 * Stringify value to TOON string with schema validation
 *
 * @experimental
 */
export const stringifyToon = <A, I>(
  schema: Schema.Schema<A, I>,
  value: A,
  options?: ToonEncodeOptions,
): Effect.Effect<string, StringifyError | ValidationError> =>
  Effect.gen(function* () {
    yield* validateForStringify(schema, value);
    // Cast options to any to satisfy the backend interface which expects StringifyOptions
    // In a real scenario, we might want to align these types better
    const result = yield* toonBackend.stringify(value, options as any);
    return result;
  });
