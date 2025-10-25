/**
 * JSONC Backend - JSON with Comments
 *
 * Strips single-line (//) and multi-line (/* *\/) comments before parsing
 */

import { stripComments, toString } from "../utils/index.js";
import { jsonBackend } from "./json.js";
import type { Backend } from "./types.js";

/**
 * JSONC Backend implementation
 *
 * Strips comments while preserving line numbers for error reporting,
 * then delegates to JSON backend
 */
export const jsoncBackend: Backend = {
  parse: (input) => {
    const stripped = stripComments(toString(input));
    return jsonBackend.parse(stripped);
  },

  stringify: (value, options) =>
    // JSONC stringify is identical to JSON (we don't inject comments)
    jsonBackend.stringify(value, options),
};
