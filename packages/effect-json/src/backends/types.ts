/**
 * Backend interface for JSON serialization
 *
 * All backends must implement this interface to be pluggable
 */

import type { Effect } from "effect";
import type { ParseError, StringifyError } from "../errors.js";

export type StringifyOptions = {
  readonly indent?: number;
};

/**
 * Backend interface
 *
 * Backends handle the actual parsing and stringification logic
 * The validation layer sits on top of backends
 */
export interface Backend {
  /**
   * Parse input (string or Buffer) into unknown data
   *
   * Returns Effect with ParseError on failure
   */
  readonly parse: (input: string | Buffer) => Effect.Effect<unknown, ParseError>;

  /**
   * Stringify value into string representation
   *
   * Returns Effect with StringifyError on failure
   */
  readonly stringify: (
    value: unknown,
    options?: StringifyOptions,
  ) => Effect.Effect<string, StringifyError>;
}
