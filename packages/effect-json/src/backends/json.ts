/**
 * JSON Backend - Standard JSON.parse/JSON.stringify with Effect error handling
 */

import { Effect } from "effect";
import { ParseError, StringifyError } from "../errors.js";
import { buildSnippet, getLineColumn, toString } from "../utils/index.js";
import type { Backend, StringifyOptions } from "./types.js";

/**
 * JSON Backend implementation
 *
 * Uses native JSON.parse and JSON.stringify with comprehensive error handling
 */
export const jsonBackend: Backend = {
  parse: (input) =>
    Effect.try({
      try: () => JSON.parse(toString(input)) as unknown,
      catch: (error) => {
        const inputStr = toString(input);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Try to extract position from error message
        // Node.js/V8 format: "Unexpected token } in JSON at position 15"
        const positionMatch = errorMessage.match(/position (\d+)/);
        const position = positionMatch ? Number.parseInt(positionMatch[1]!, 10) : 0;

        const { line, column } = getLineColumn(inputStr, position);
        const snippet = buildSnippet(inputStr, position);

        return new ParseError({
          message: errorMessage,
          line,
          column,
          snippet,
          cause: error instanceof Error ? error : undefined,
        });
      },
    }),

  stringify: (value, options) =>
    Effect.try({
      try: () => JSON.stringify(value, null, options?.indent ?? 0),
      catch: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Detect circular reference (Bun uses "cyclic", V8 uses "circular")
        const lowerMessage = errorMessage.toLowerCase();
        const reason =
          lowerMessage.includes("circular") || lowerMessage.includes("cyclic")
            ? ("cycle" as const)
            : ("unknown" as const);

        return new StringifyError({
          message: errorMessage,
          reason,
          cause: error instanceof Error ? error : undefined,
        });
      },
    }),
};
