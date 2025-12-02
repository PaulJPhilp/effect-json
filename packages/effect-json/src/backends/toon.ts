/**
 * TOON Backend - Experimental TOON support
 */

import { decode, encode } from "@toon-format/toon";
import { Effect } from "effect";
import { ParseError, StringifyError } from "../errors.js";
import { buildSnippet, getLineColumn, toString } from "../utils/index.js";
import type { Backend } from "./types.js";

/**
 * TOON Backend implementation
 *
 * Uses @toon-format/toon for parsing and stringification
 */
export const toonBackend: Backend = {
  parse: (input) =>
    Effect.try({
      try: () => decode(toString(input)) as unknown,
      catch: (error) => {
        const inputStr = toString(input);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // TOON errors might not have position info in the same way as JSON
        // We'll try to extract it if available, otherwise default to 0
        // Adjust regex based on actual TOON error format if known
        const positionMatch = errorMessage.match(/position (\d+)/);
        const position = positionMatch ? Number.parseInt(positionMatch[1]!, 10) : 0;

        const { line, column } = getLineColumn(inputStr, position);
        const snippet = buildSnippet(inputStr, position);

        return new ParseError({
          message: `TOON Parse Error: ${errorMessage}`,
          line,
          column,
          snippet,
          cause: error instanceof Error ? error : undefined,
        });
      },
    }),

  stringify: (value, options) =>
    Effect.try({
      try: () => encode(value, options),
      catch: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return new StringifyError({
          message: `TOON Stringify Error: ${errorMessage}`,
          reason: "unknown", // TOON specific errors might map to other reasons
          cause: error instanceof Error ? error : undefined,
        });
      },
    }),
};
