/**
 * String utility functions for effect-json
 */

/**
 * Convert Buffer to string
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: Intentional utility function name
export const toString = (input: string | Buffer): string =>
  typeof input === "string" ? input : input.toString("utf-8");

/**
 * Build error snippet with pointer to error location
 *
 * @example
 * buildSnippet('{"id": 1, invalid}', 15)
 * // Returns:
 * // {"id": 1, invalid}
 * //                ^
 */
export const buildSnippet = (input: string, position: number): string => {
  const lines = input.split("\n");
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line?.length ?? 0;

    if (currentPos + lineLength >= position) {
      const column = position - currentPos;
      const pointer = `${" ".repeat(column)}^`;
      return `${line}\n${pointer}`;
    }

    currentPos += lineLength + 1; // +1 for newline
  }

  return input;
};

/**
 * Get line and column from position in string
 */
export const getLineColumn = (
  input: string,
  position: number,
): { line: number; column: number } => {
  const lines = input.split("\n");
  let currentPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line?.length ?? 0;

    if (currentPos + lineLength >= position) {
      return {
        line: i + 1,
        column: position - currentPos + 1,
      };
    }

    currentPos += lineLength + 1; // +1 for newline
  }

  return { line: 1, column: 1 };
};

/**
 * Strip comments from JSONC (JSON with Comments)
 *
 * Supports:
 * - Single-line comments: // comment
 * - Multi-line comments: /* comment *\/
 *
 * Preserves line numbers for error reporting
 */
export const stripComments = (input: string): string => {
  const result: string[] = [];
  let inString = false;
  let inComment = false;
  let inMultilineComment = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const nextChar = input[i + 1];

    if (escapeNext) {
      result.push(char);
      escapeNext = false;
      continue;
    }

    if (!inString && !inComment && !inMultilineComment) {
      if (char === '"') {
        inString = true;
        result.push(char!);
      } else if (char === "/" && nextChar === "/") {
        inComment = true;
        i++; // skip next /
      } else if (char === "/" && nextChar === "*") {
        inMultilineComment = true;
        i++; // skip next *
      } else {
        result.push(char!);
      }
    } else if (inString) {
      if (char === "\\") {
        escapeNext = true;
        result.push(char!);
      } else if (char === '"') {
        inString = false;
        result.push(char!);
      } else {
        result.push(char!);
      }
    } else if (inComment) {
      if (char === "\n") {
        inComment = false;
        result.push(char!); // preserve line for error reporting
      }
      // skip comment characters
    } else if (inMultilineComment) {
      if (char === "*" && nextChar === "/") {
        inMultilineComment = false;
        i++; // skip next /
      } else if (char === "\n") {
        result.push(char!); // preserve line
      }
      // skip comment characters
    }
  }

  return result.join("");
};
