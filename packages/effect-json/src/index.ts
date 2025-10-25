/**
 * effect-json - Type-safe, schema-driven JSON serialization for Effect
 *
 * @packageDocumentation
 */

// Core API
export {
  parse,
  parseJsonc,
  parseSuperjson,
  stringify,
  stringifyJsonc,
  stringifySuperjson,
} from "./api.js";
// Backends (advanced usage)
export {
  type Backend,
  jsonBackend,
  jsoncBackend,
  type StringifyOptions,
  superjsonBackend,
} from "./backends/index.js";
// Configuration & DI
export { JsonService, JsonServiceLive, mockBackend } from "./config.js";
// Errors
export { ParseError, StringifyError, ValidationError } from "./errors.js";
// Schema utilities
export { validateAgainstSchema, validateForStringify } from "./schema.js";
// Testing utilities
export { mockBackend as testMockBackend } from "./testing.js";
