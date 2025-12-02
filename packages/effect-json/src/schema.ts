/**
 * Schema validation utilities
 *
 * Integrates Effect.Schema with effect-json error handling
 */

import { Effect, ParseResult, Schema } from "effect";
import { ValidationError } from "./errors.js";

/**
 * Validate data against a schema
 *
 * Wraps Schema.decode with ValidationError
 */
export const validateAgainstSchema = <A, I, R = never>(
  schema: Schema.Schema<A, I, R>,
  data: I,
): Effect.Effect<A, ValidationError, R> =>
  Schema.decode(schema)(data).pipe(
    Effect.mapError((parseError) => {
      // Extract path information from ParseError
      const message = ParseResult.TreeFormatter.formatErrorSync(parseError);

      return new ValidationError({
        message: `Schema validation failed: ${message}`,
        schemaPath: String(schema),
        expected: schema,
        actual: data,
        cause: parseError as unknown as Error,
      });
    }),
  );

/**
 * Validate before stringify (ensures data conforms to schema)
 *
 * Uses Schema.encode to validate that data can be encoded
 */
export const validateForStringify = <A, I, R = never>(
  schema: Schema.Schema<A, I, R>,
  data: A,
): Effect.Effect<A, ValidationError, R> =>
  Schema.encode(schema)(data).pipe(
    Effect.map(() => data),
    Effect.mapError((parseError) => {
      const message = ParseResult.TreeFormatter.formatErrorSync(parseError);

      return new ValidationError({
        message: `Validation failed before stringify: ${message}`,
        schemaPath: String(schema),
        expected: schema,
        actual: data,
        cause: parseError as unknown as Error,
      });
    }),
  );
