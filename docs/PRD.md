# effect-json – Product Requirements Document

> **Status**: ✅ Completed | **Version**: 0.1.0 Published | **Date**: October 2025
>
> This is a historical planning document. All product requirements have been successfully implemented and the library is published on npm.

## Overview

**effect-json** is a composable, schema-driven JSON serialization library for TypeScript and Effect. It provides multiple backends (JSON, JSONC, SuperJSON) unified under a single, Effect-native API.

---

## Core Capabilities (v1.0)

### 1. Parse JSON with Schema Validation

```typescript
import { Json } from "effect-json";
import * as Schema from "effect/Schema";

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
});

const jsonString = '{"id": 1, "name": "Paul", "email": "paul@example.com"}';

const effect = Json.parse(UserSchema, jsonString);
// Effect<User, ParseError, never>

const user = await Effect.runPromise(effect);
// { id: 1, name: "Paul", email: "paul@example.com" }
```

**Requirements:**
- Accept a schema and a JSON string (or buffer)
- Return `Effect<A, ParseError, never>` where A is the schema type
- Validate parsed data against the schema
- Throw `ParseError` with line/column info if parsing fails
- Throw `ValidationError` if schema validation fails

---

### 2. Parse JSONC (JSON with Comments)

```typescript
const jsonc = `
{
  // User ID (required)
  "id": 1,
  /* Multi-line comment:
     User name for display */
  "name": "Paul"
}
`;

const effect = Json.parseJsonc(UserSchema, jsonc);
// Comments are stripped; otherwise identical to parseJson
```

**Requirements:**
- Support single-line (`//`) and multi-line (`/* */`) comments
- Strip comments before parsing
- Return same type as `parseJson`
- Error handling identical to JSON parser

---

### 3. Stringify with Schema Awareness

```typescript
const user = { id: 1, name: "Paul", email: "paul@example.com" };

// Pretty-printed JSON
const effect = Json.stringify(UserSchema, user, { indent: 2 });
// Effect<string, StringifyError, never>

const json = await Effect.runPromise(effect);
// '{\\n  "id": 1,\\n  "name": "Paul",\\n  "email": "paul@example.com"\\n}'

// Compact JSON
const compact = await Effect.runPromise(
  Json.stringify(UserSchema, user, { indent: 0 })
);
// '{"id":1,"name":"Paul","email":"paul@example.com"}'
```

**Requirements:**
- Accept schema, value, and options (indent, etc.)
- Return `Effect<string, StringifyError, never>`
- Validate value against schema before stringifying
- Support indentation (0 = compact, 2 = pretty, etc.)

---

### 4. SuperJSON Backend (Type-Preserving Serialization)

```typescript
const ComplexSchema = Schema.Struct({
  id: Schema.Number,
  createdAt: Schema.Date,
  tags: Schema.Array(Schema.String),
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
});

const data = {
  id: 1,
  createdAt: new Date("2025-01-01"),
  tags: ["typescript", "effect"],
  metadata: { version: "1.0" },
};

// SuperJSON preserves Date, Set, Map, BigInt, etc.
const effect = Json.stringifySuperjson(ComplexSchema, data);
// Returns: { "json": {...}, "meta": { "values": [...] } }
// Allows round-trip: parse it back and get original Date, Set, etc.

const roundTrip = await Effect.runPromise(
  Effect.flatMap(
    Json.stringifySuperjson(ComplexSchema, data),
    (superjson) => Json.parseSuperjson(ComplexSchema, superjson)
  )
);
// roundTrip.createdAt is a Date, not a string
```

**Requirements:**
- Support Date, Set, Map, BigInt, RegExp, undefined, NaN, Infinity
- Preserve type information in metadata
- Round-trip guarantee: parse(stringify(value)) === value (by value, not reference)
- Compatible with SuperJSON library format

---

### 5. Error Precision & Handling

```typescript
const badJson = '{"id": 1, "name": "Paul", invalid}';

const effect = Json.parse(UserSchema, badJson);

const result = await Effect.runPromise(
  Effect.either(effect)
);
// Left(ParseError {
//   message: 'Unexpected token } at line 1, column 32',
//   line: 1,
//   column: 32,
//   snippet: '{"id": 1, "name": "Paul", invalid}',
//           '                               ^'
// })
```

**Requirements:**
- `ParseError`: Line/column, snippet with pointer, actionable message
- `ValidationError`: Schema path, expected vs. actual, suggestion for fix
- `StringifyError`: Schema mismatch, type error, suggestion for fix
- All errors are tagged (use `Data.TaggedError` from Effect Patterns)

---

### 6. Pluggable Backends

```typescript
// Define a new backend
const MyBackend: Json.Backend = {
  parse: (input) => Effect.try(() => myCustomParse(input)),
  stringify: (value, options) =>
    Effect.sync(() => myCustomStringify(value, options)),
};

// Register it
const customJson = Json.withBackend(MyBackend);

// Use it
const result = await Effect.runPromise(
  customJson.parse(UserSchema, input)
);
```

**Requirements:**
- Backend interface: `{ parse, stringify }`
- Each backend implements independently
- Compose backends with configuration
- Testable: provide in-memory or mock backends for testing

---

### 7. Configuration & Composition

```typescript
// Create a configured instance
const json = Json.create({
  backend: "superjson", // "json" | "jsonc" | "superjson"
  indent: 2,
  onParseError: (error) =>
    Effect.logError(`Parse failed: ${error.message}`),
  onStringifyError: (error) =>
    Effect.logError(`Stringify failed: ${error.message}`),
});

// Use throughout app
const result = await Effect.runPromise(
  json.parse(UserSchema, input)
);
```

**Requirements:**
- Sensible defaults (backend: "json", indent: 0)
- Overridable per operation or globally
- Support hooks/callbacks for error handling, logging
- Composable with Effect.Layer for DI

---

### 8. Round-Trip Consistency Guarantees

```typescript
// Guarantee: parse(stringify(value)) === value (structurally)
// Using Data.struct for equality

const original = { id: 1, name: "Paul" };
const stringified = await Effect.runPromise(
  Json.stringify(UserSchema, original)
);
const reparsed = await Effect.runPromise(
  Json.parse(UserSchema, stringified)
);

// Data.equals(original, reparsed) === true
```

**Requirements:**
- All backends guarantee round-trip fidelity
- Tested with golden fixtures (JSONC format with comments)
- Applies to JSON, JSONC, and SuperJSON

---

### 9. Observability & Logging

```typescript
// All operations are observable via Effect's built-in logging
const effect = Json.parse(UserSchema, input)
  .pipe(
    Effect.tap((value) => Effect.logInfo(`Parsed: ${JSON.stringify(value)}`))
  );

// Structured logging included by default
// Via Effect.Logger + configurable levels (debug, info, warn, error)
```

**Requirements:**
- Use Effect's built-in logging (Effect.logInfo, etc.)
- Emit structured logs with context (operation, schema, backend, duration)
- No additional logging library dependency

---

## API Surface

### Main Module: `effect-json`

```typescript
// Parse operations
export const parse: <A>(
  schema: Schema.Schema<A>,
  input: string | Buffer
) => Effect.Effect<A, ParseError>;

export const parseJsonc: <A>(
  schema: Schema.Schema<A>,
  input: string | Buffer
) => Effect.Effect<A, ParseError>;

export const parseSuperjson: <A>(
  schema: Schema.Schema<A>,
  input: string | Buffer | Record<string, unknown>
) => Effect.Effect<A, ParseError | ValidationError>;

// Stringify operations
export const stringify: <A>(
  schema: Schema.Schema<A>,
  value: A,
  options?: StringifyOptions
) => Effect.Effect<string, StringifyError>;

export const stringifyJsonc: <A>(
  schema: Schema.Schema<A>,
  value: A,
  options?: StringifyOptions & { comments?: Record<string, string> }
) => Effect.Effect<string, StringifyError>;

export const stringifySuperjson: <A>(
  schema: Schema.Schema<A>,
  value: A,
  options?: StringifyOptions
) => Effect.Effect<string | object, StringifyError>;

// Configuration & composition
export const create: (config: JsonConfig) => JsonInstance;

export const withBackend: (backend: Backend) => JsonInstance;

// Error types (tagged)
export class ParseError extends Data.TaggedError<"ParseError"> {
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
}

export class ValidationError extends Data.TaggedError<"ValidationError"> {
  readonly schemaPath: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export class StringifyError extends Data.TaggedError<"StringifyError"> {
  readonly reason: "schema_mismatch" | "type_error" | "cycle";
}
```

### Submodules

- `effect-json/backends` – Backend implementations (JSON, JSONC, SuperJSON)
- `effect-json/schema` – Schema utilities and helpers
- `effect-json/errors` – Error types and utilities
- `effect-json/testing` – Test utilities (mock backends, fixtures)

---

## Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Zero external dependencies | (except Effect) | Composability, minimal bundle |
| TypeScript strict mode | 100% compliance | Type safety, agent clarity |
| Test coverage | ≥90% | Reliability, regression prevention |
| Parse error line/column | Always provided | Developer UX, debuggability |
| Round-trip fidelity | 100% | Correctness, testability |
| Agent parseable | Clear contracts, examples | AI implementation support |

---

## Constraints & Trade-offs

### Design Decisions

1. **Effect-native only** (no sync APIs)
   - Rationale: Forces honest effect boundaries; composable with Effect ecosystem
   - Trade-off: Cannot use in contexts requiring sync JSON parsing (acceptable; use JSON.parse for those)

2. **Schema-driven** (require Effect.Schema)
   - Rationale: Single source of truth for types; validation at parse time
   - Trade-off: Requires schema definition upfront (best practice anyway)

3. **Multiple backends, single API**
   - Rationale: Swap implementations without changing code
   - Trade-off: Slightly more abstractions; worth the flexibility

4. **Precise errors with line/column**
   - Rationale: Essential for developer experience (config files, test fixtures)
   - Trade-off: Small overhead for error object construction (negligible)

---

## Success Criteria (v1.0)

- [ ] All core capabilities (parse, stringify, all backends) implemented
- [ ] ≥90% test coverage (unit + integration + golden fixtures)
- [ ] Zero TypeScript errors; full strict mode
- [ ] Documentation (API, patterns, examples) agent-parseable
- [ ] Integration: effect-env and effect-xstate use effect-json
- [ ] Performance: parse/stringify < 1ms for typical payloads (<100KB)

---

## Roadmap

### v1.0 (MVP)
- JSON, JSONC, SuperJSON backends
- Parse/stringify with schema validation
- Precise error handling
- Core documentation

### v1.1 (Polish & Integration)
- Add to effect-env and effect-xstate
- Community feedback integration
- Performance optimization
- Advanced examples

### v2.0+ (Future)
- Additional backends (PKL, MessagePack)
- Streaming JSON (for large files)
- Caching layer for repeated operations
- Plugin/extension system