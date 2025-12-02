/**
 * Error types for effect-json
 *
 * All errors are tagged using Effect's Data.TaggedError pattern
 * for composable error handling with catchTag
 */

import { Data } from "effect";

/**
 * ParseError - Thrown when JSON parsing fails
 *
 * Includes line/column information for debugging
 */
export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
  readonly cause?: Error;
}> {}

/**
 * ValidationError - Thrown when schema validation fails
 *
 * Includes schema path and expected vs actual information
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly schemaPath: string;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly cause?: Error;
}> {}

/**
 * StringifyError - Thrown when JSON stringification fails
 *
 * Includes reason for failure (schema mismatch, type error, circular reference)
 */
export class StringifyError extends Data.TaggedError("StringifyError")<{
  readonly message: string;
  readonly reason: "schema_mismatch" | "type_error" | "cycle" | "unknown";
  readonly cause?: Error;
}> {}

/**
 * JsonLinesParseError - Thrown when JSON Lines parsing fails
 *
 * Includes line number (which line in the JSONL) and position within that line
 */
export class JsonLinesParseError extends Data.TaggedError("JsonLinesParseError")<{
  readonly message: string;
  readonly lineNumber: number; // 1-indexed line number in the JSONL file
  readonly line: number; // position within the line (for compatibility)
  readonly column: number; // column within the line
  readonly snippet: string; // error snippet from the line
  readonly cause?: Error;
}> {}
