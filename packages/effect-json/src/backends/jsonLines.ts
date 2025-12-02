/**
 * JSON Lines Backend - Newline-delimited JSON with Effect error handling
 *
 * Supports both batch (array) and streaming parsing/stringifying
 */

import { Effect, Stream } from "effect";
import { JsonLinesParseError, ParseError } from "../errors.js";
import { buildSnippet, getLineColumn, toString } from "../utils/index.js";

/**
 * Options for stringifying JSON Lines
 */
export type JsonLinesStringifyOptions = {
  readonly indent?: number; // For individual JSON values (usually 0 for JSONL)
};

/**
 * Split input into lines, normalizing line endings
 * Removes empty/whitespace-only lines
 */
const splitLines = (input: string): ReadonlyArray<string> => {
  const normalized = input.replace(/\r\n/g, "\n");
  return normalized.split("\n").filter((line) => line.trim().length > 0);
};

/**
 * Parse a single line of JSON
 *
 * Returns Effect with JsonLinesParseError including line number
 */
const parseLine = (
  line: string,
  lineNumber: number,
): Effect.Effect<unknown, JsonLinesParseError> =>
  Effect.try({
    try: () => JSON.parse(line) as unknown,
    catch: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Extract position from error message (if available)
      const positionMatch = errorMessage.match(/position (\d+)/);
      const position = positionMatch ? Number.parseInt(positionMatch[1]!, 10) : 0;

      const { line: _, column } = getLineColumn(line, position);
      const snippet = buildSnippet(line, position);

      return new JsonLinesParseError({
        message: `Line ${lineNumber}: ${errorMessage}`,
        lineNumber,
        line: 1, // Always 1 since we're parsing a single line
        column,
        snippet,
        cause: error instanceof Error ? error : undefined,
      });
    },
  });

/**
 * Parse entire JSONL string into array of values
 *
 * Skips blank lines, fails fast on first error
 */
export const parseBatch = (
  input: string | Buffer,
): Effect.Effect<ReadonlyArray<unknown>, JsonLinesParseError> => {
  const inputStr = toString(input);
  const lines = splitLines(inputStr);

  // If no valid lines, return empty array
  if (lines.length === 0) {
    return Effect.succeed([]);
  }

  // Parse each line and collect results
  return Effect.all(
    lines.map((line, index) => parseLine(line, index + 1)),
    { concurrency: "unbounded" },
  );
};

/**
 * Stringify array of values to JSONL string
 *
 * Each value becomes one line, separated by \n
 */
export const stringifyBatch = (
  values: Iterable<unknown>,
  options?: JsonLinesStringifyOptions,
): Effect.Effect<string, ParseError> => {
  const valuesArray = Array.from(values);

  // Empty array produces empty string
  if (valuesArray.length === 0) {
    return Effect.succeed("");
  }

  return Effect.try({
    try: () => {
      const lines = valuesArray.map((value) =>
        JSON.stringify(value, null, options?.indent ?? 0),
      );
      return lines.join("\n") + "\n"; // Trailing newline is conventional
    },
    catch: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new ParseError({
        message: `Failed to stringify JSONL: ${errorMessage}`,
        line: 1,
        column: 1,
        snippet: "",
        cause: error instanceof Error ? error : undefined,
      });
    },
  });
};

/**
 * Line buffer for streaming parser
 *
 * Maintains partial line state across chunks
 */
class LineBuffer {
  private buffer = "";
  private lineNumber = 0;

  /**
   * Process incoming chunk and emit complete lines
   */
  processChunk(chunk: string): ReadonlyArray<{ line: string; lineNumber: number }> {
    this.buffer += chunk;
    const lines: Array<{ line: string; lineNumber: number }> = [];

    // Find all complete lines (up to last \n)
    let lastNewlineIndex = this.buffer.lastIndexOf("\n");

    if (lastNewlineIndex === -1) {
      // No complete lines yet
      return [];
    }

    // Extract complete lines
    const completeText = this.buffer.slice(0, lastNewlineIndex);
    this.buffer = this.buffer.slice(lastNewlineIndex + 1);

    // Split and filter
    const splitLines = completeText.split("\n");
    for (const line of splitLines) {
      if (line.trim().length > 0) {
        this.lineNumber++;
        lines.push({ line, lineNumber: this.lineNumber });
      }
    }

    return lines;
  }

  /**
   * Flush remaining buffer at end of stream
   */
  flush(): ReadonlyArray<{ line: string; lineNumber: number }> {
    if (this.buffer.trim().length > 0) {
      this.lineNumber++;
      return [{ line: this.buffer.trim(), lineNumber: this.lineNumber }];
    }
    return [];
  }
}

/**
 * Parse stream of string chunks into stream of parsed values
 *
 * Handles arbitrary chunk boundaries (may split lines mid-way)
 */
export const parseStream = <R>(
  input: Stream.Stream<string, never, R>,
): Stream.Stream<unknown, JsonLinesParseError, R> => {
  const buffer = new LineBuffer();

  return input.pipe(
    Stream.mapEffect((chunk) => {
      const lines = buffer.processChunk(chunk);
      return Effect.succeed(lines);
    }),
    Stream.flatMap((lines) => Stream.fromIterable(lines)),
    Stream.concat(
      Stream.fromEffect(Effect.succeed(buffer.flush())).pipe(
        Stream.flatMap((lines) => Stream.fromIterable(lines)),
      ),
    ),
    Stream.mapEffect(({ line, lineNumber }) => parseLine(line, lineNumber)),
  );
};

/**
 * Stringify stream of values into stream of JSONL strings
 *
 * Each value becomes a line with trailing \n
 */
export const stringifyStream = <R>(
  values: Stream.Stream<unknown, never, R>,
  options?: JsonLinesStringifyOptions,
): Stream.Stream<string, ParseError, R> =>
  values.pipe(
    Stream.mapEffect((value) =>
      Effect.try({
        try: () => JSON.stringify(value, null, options?.indent ?? 0) + "\n",
        catch: (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          return new ParseError({
            message: `Failed to stringify value: ${errorMessage}`,
            line: 1,
            column: 1,
            snippet: "",
            cause: error instanceof Error ? error : undefined,
          });
        },
      }),
    ),
  );
