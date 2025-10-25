/**
 * Configuration and service layer for effect-json
 *
 * Provides dependency injection via Effect.Layer for testing and advanced use cases
 */

import { Context, Effect, type Schema } from "effect";
import * as api from "./api.js";
import type { Backend, StringifyOptions } from "./backends/types.js";
import { ParseError, StringifyError, type ValidationError } from "./errors.js";

/**
 * JsonService - Service interface for dependency injection
 *
 * Allows swapping backends and configurations for testing
 */
export class JsonService extends Context.Tag("@effect-json/JsonService")<
  JsonService,
  {
    readonly parse: <A, I>(
      schema: Schema.Schema<A, I>,
      input: string | Buffer,
    ) => Effect.Effect<A, ParseError | ValidationError>;

    readonly stringify: <A, I>(
      schema: Schema.Schema<A, I>,
      value: A,
      options?: StringifyOptions,
    ) => Effect.Effect<string, StringifyError | ValidationError>;

    readonly parseJsonc: <A, I>(
      schema: Schema.Schema<A, I>,
      input: string | Buffer,
    ) => Effect.Effect<A, ParseError | ValidationError>;

    readonly parseSuperjson: <A, I>(
      schema: Schema.Schema<A, I>,
      input: string | Buffer,
    ) => Effect.Effect<A, ParseError | ValidationError>;

    readonly stringifySuperjson: <A, I>(
      schema: Schema.Schema<A, I>,
      value: A,
      options?: StringifyOptions,
    ) => Effect.Effect<string, StringifyError | ValidationError>;
  }
>() {}

/**
 * Default JsonService layer
 *
 * Uses standard backends (JSON, JSONC, SuperJSON)
 */
export const JsonServiceLive = JsonService.of({
  parse: (schema, input) => api.parse(schema, input),
  stringify: (schema, value, options) => api.stringify(schema, value, options),
  parseJsonc: (schema, input) => api.parseJsonc(schema, input),
  parseSuperjson: (schema, input) => api.parseSuperjson(schema, input),
  stringifySuperjson: (schema, value, options) => api.stringifySuperjson(schema, value, options),
});

/**
 * Mock backend for testing
 *
 * Uses simple JSON.parse/stringify without SuperJSON
 */
export const mockBackend: Backend = {
  parse: (input) =>
    Effect.try({
      try: () => JSON.parse(String(input)) as unknown,
      catch: (error) =>
        new ParseError({
          message: error instanceof Error ? error.message : String(error),
          line: 0,
          column: 0,
          snippet: String(input),
          cause: error instanceof Error ? error : undefined,
        }),
    }),

  stringify: (value, options) =>
    Effect.try({
      try: () => JSON.stringify(value, null, options?.indent ?? 0),
      catch: (error) =>
        new StringifyError({
          message: error instanceof Error ? error.message : String(error),
          reason: "unknown",
          cause: error instanceof Error ? error : undefined,
        }),
    }),
};
