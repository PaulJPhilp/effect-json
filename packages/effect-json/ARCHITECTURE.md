# effect-json – Architecture

## High-Level Design

```
┌─────────────────────────────────────────────────────┐
│                  Public API Layer                   │
│  (parse, stringify, parseJsonc, parseSuperjson)     │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────┐
│          Configuration & Composition Layer          │
│  (JsonService, JsonServiceLive, mockBackend)        │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────┐
│            Schema Validation Layer                  │
│  (validateAgainstSchema, validateForStringify)      │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────────┐
│             Backend Layer                           │
│  ┌──────────────┬──────────────┬──────────────┐    │
│  │ JSON Backend │ JSONC Backend│ SuperJSON    │    │
│  │              │              │ Backend      │    │
│  └──────────────┴──────────────┴──────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Core Layers

### 1. Public API Layer

**Module**: `src/api.ts`

Exports top-level convenience functions for common use cases:
- `parse(schema, input)` - Parse JSON with schema validation
- `stringify(schema, value, options?)` - Stringify to JSON
- `parseJsonc(schema, input)` - Parse JSONC (strips comments)
- `stringifyJsonc(schema, value, options?)` - Stringify to JSON (no comment injection)
- `parseSuperjson(schema, input)` - Parse SuperJSON with type preservation
- `stringifySuperjson(schema, value, options?)` - Stringify with type metadata

**Characteristics:**
- Thin wrapper over backend execution + schema validation
- All operations return `Effect<A, ParseError | ValidationError | StringifyError, never>`
- No side effects; pure composition
- Each function delegates to appropriate backend + validation layer

**Implementation Pattern** (Effect.gen):

```typescript
export const parse = <A, I>(
  schema: Schema.Schema<A, I>,
  input: string | Buffer,
): Effect.Effect<A, ParseError | ValidationError> =>
  Effect.gen(function* () {
    const raw = yield* jsonBackend.parse(input);
    const validated = yield* validateAgainstSchema(schema, raw as I);
    return validated;
  });
```

---

### 2. Configuration & Composition Layer

**Module**: `src/config.ts`

Provides dependency injection via `JsonService` for advanced use cases and testing.

**JsonService**:
- Service tag: `"@effect-json/JsonService"`
- Exposes same methods as public API
- Allows swapping backends/configurations without changing code

**JsonServiceLive**:
- Default layer implementation
- Uses standard backends (json, jsonc, superjson)

**mockBackend**:
- Simple JSON.parse/stringify for testing
- No SuperJSON dependency
- Used in test environments

**Usage Pattern**:

```typescript
// Direct usage (80% of cases)
const user = await Effect.runPromise(Json.parse(UserSchema, input));

// With DI (testing, complex scenarios)
const effect = Effect.gen(function* () {
  const json = yield* JsonService;
  const parsed = yield* json.parse(UserSchema, input);
  return parsed;
}).pipe(Effect.provideLayer(JsonServiceLive));
```

---

### 3. Schema Validation Layer

**Module**: `src/schema.ts`

Integrates Effect.Schema with effect-json error handling.

**validateAgainstSchema**:
- Wraps `Schema.decode` with `ValidationError`
- Formats parse errors using `TreeFormatter`
- Returns structured error with schema path, expected vs actual

**validateForStringify**:
- Uses `Schema.encode` to validate encoding capability
- Important for SuperJSON: ensures `Date` objects can be encoded
- Returns original data on success (doesn't modify)

**Key Pattern - DateFromSelf**:

```typescript
// For JSON (string representation)
const JsonSchema = Schema.Struct({
  createdAt: Schema.Date, // Expects ISO string, decodes to Date
});

// For SuperJSON (already Date objects)
const SuperJsonSchema = Schema.Struct({
  createdAt: Schema.DateFromSelf, // Expects Date, encodes Date
});
```

**Why this matters**:
- `Schema.Date`: Transforms `string → Date` (decode) and `Date → string` (encode)
- `Schema.DateFromSelf`: Validates `Date → Date` (identity transformation)
- SuperJSON preserves Date objects, so use `DateFromSelf`
- JSON represents dates as strings, so use `Schema.Date`

---

### 4. Backend Layer

**Module**: `src/backends/`

Each backend implements the `Backend` interface:

```typescript
export interface Backend {
  readonly parse: (
    input: string | Buffer,
  ) => Effect.Effect<unknown, ParseError>;

  readonly stringify: (
    value: unknown,
    options?: StringifyOptions,
  ) => Effect.Effect<string, StringifyError>;
}
```

#### 4.1 JSON Backend

**Module**: `src/backends/json.ts`

```typescript
export const jsonBackend: Backend = {
  parse: (input) =>
    Effect.try({
      try: () => JSON.parse(toStringHelper(input)) as unknown,
      catch: (error) => {
        const inputStr = toStringHelper(input);
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Extract position from error message
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
        const reason = errorMessage.toLowerCase().includes("circular")
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
```

**Pattern** (from Effect Patterns - Error Handling with Effect.try):
- Wrap synchronous operations in `Effect.try`
- Extract error details for rich context
- Classify errors (e.g., "cycle" for circular references)

---

#### 4.2 JSONC Backend

**Module**: `src/backends/jsonc.ts`

```typescript
export const jsoncBackend: Backend = {
  parse: (input) => {
    const stripped = stripComments(toStringHelper(input));
    return jsonBackend.parse(stripped);
  },

  stringify: (value, options) =>
    // JSONC stringify is identical to JSON (we don't inject comments)
    jsonBackend.stringify(value, options),
};
```

**Comment Stripping** (`src/utils/string.ts`):
```typescript
export const stripComments = (input: string): string => {
  const result: string[] = [];
  let inString = false;
  let inComment = false;
  let inMultilineComment = false;
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const nextChar = input[i + 1];

    // Handle escape sequences in strings
    if (escapeNext) {
      result.push(char);
      escapeNext = false;
      continue;
    }

    // State machine: track strings, single-line comments, multi-line comments
    if (!inString && !inComment && !inMultilineComment) {
      if (char === '"') {
        inString = true;
        result.push(char);
      } else if (char === "/" && nextChar === "/") {
        inComment = true;
        i++; // skip next /
      } else if (char === "/" && nextChar === "*") {
        inMultilineComment = true;
        i++; // skip next *
      } else {
        result.push(char);
      }
    } else if (inString) {
      if (char === "\\") {
        escapeNext = true;
        result.push(char);
      } else if (char === '"') {
        inString = false;
        result.push(char);
      } else {
        result.push(char);
      }
    } else if (inComment) {
      if (char === "\n") {
        inComment = false;
        result.push(char); // preserve line for error reporting
      }
    } else if (inMultilineComment) {
      if (char === "*" && nextChar === "/") {
        inMultilineComment = false;
        i++; // skip next /
      } else if (char === "\n") {
        result.push(char); // preserve line
      }
    }
  }

  return result.join("");
};
```

**Pattern** (from Effect Patterns - Transform Data During Validation):
- Pre-process input (strip comments) before passing to JSON parser
- Preserve line numbers by keeping `\n` characters
- Respect string boundaries (don't strip `//) inside strings)

---

#### 4.3 SuperJSON Backend

**Module**: `src/backends/superjson.ts`

```typescript
const loadSuperjson = () =>
  Effect.tryPromise({
    try: async () => {
      const superjson = await import("superjson");
      return (
        superjson.default ||
        (superjson as {
          parse: (json: string) => unknown;
          stringify: (value: unknown) => string;
        })
      );
    },
    catch: (error) => {
      const message =
        error instanceof Error && error.message.includes("Cannot find module")
          ? "superjson is not installed. Install with: bun add superjson\n" +
            "Alternatively, use Json.parse() with the JSON backend as a fallback."
          : error instanceof Error
            ? error.message
            : String(error);

      return new ParseError({
        message,
        line: 0,
        column: 0,
        snippet: "",
        cause: error instanceof Error ? error : undefined,
      });
    },
  });

export const superjsonBackend: Backend = {
  parse: (input) =>
    Effect.gen(function* () {
      const superjson = yield* loadSuperjson();
      const inputStr = toStringHelper(input);

      return yield* Effect.try({
        try: () => {
          // Try SuperJSON parse, fallback to JSON.parse for plain JSON
          const parsed = superjson.parse(inputStr);
          if (parsed === undefined || parsed === null) {
            const plainParsed = JSON.parse(inputStr);
            return plainParsed === null ? parsed : plainParsed;
          }
          return parsed;
        },
        catch: (error) => {
          return new ParseError({
            message: `SuperJSON parse error: ${
              error instanceof Error ? error.message : String(error)
            }`,
            line: 0,
            column: 0,
            snippet: inputStr,
            cause: error instanceof Error ? error : undefined,
          });
        },
      });
    }),

  stringify: (value, options) =>
    Effect.gen(function* () {
      const superjson = yield* loadSuperjson();

      return yield* Effect.try({
        try: () => {
          const serialized = superjson.stringify(value);
          if (options?.indent) {
            const parsed = JSON.parse(serialized);
            return JSON.stringify(parsed, null, options.indent);
          }
          return serialized;
        },
        catch: (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const reason = errorMessage.toLowerCase().includes("circular")
            ? ("cycle" as const)
            : ("unknown" as const);

          return new StringifyError({
            message: `SuperJSON stringify error: ${errorMessage}`,
            reason,
            cause: error instanceof Error ? error : undefined,
          });
        },
      });
    }).pipe(
      Effect.mapError((error) =>
        error instanceof StringifyError
          ? error
          : new StringifyError({
              message: error instanceof Error ? error.message : String(error),
              reason: "unknown",
              cause: error instanceof Error ? error : undefined,
            }),
      ),
    ),
};
```

**Pattern** (from Effect Patterns - Lazy Loading & Optional Dependencies):
- Lazy import via dynamic `import()` (not `require()`)
- Optional peer dependency (won't fail at module load)
- Helpful error message suggesting fallback
- `Effect.mapError` to normalize error types

---

## Error Handling Strategy

### Error Taxonomy

```
ParseError
  ├── message: string
  ├── line: number
  ├── column: number
  ├── snippet: string (code snippet with pointer)
  └── cause?: Error

ValidationError
  ├── message: string (formatted with TreeFormatter)
  ├── schemaPath: string
  ├── expected: unknown (schema)
  ├── actual: unknown (data)
  └── cause?: Error

StringifyError
  ├── message: string
  ├── reason: "schema_mismatch" | "type_error" | "cycle" | "unknown"
  └── cause?: Error
```

### Error Recovery Pattern

```typescript
parse(UserSchema, input).pipe(
  Effect.catchTag("ParseError", (err) => {
    // Log and provide fallback
    return Effect.gen(function* () {
      yield* Effect.logError(`Parse failed: ${err.message} at ${err.line}:${err.column}`);
      return DEFAULT_USER;
    });
  }),
  Effect.catchTag("ValidationError", (err) => {
    // Escalate validation errors
    return Effect.gen(function* () {
      yield* Effect.logError(`Validation failed: ${err.message}`);
      return yield* Effect.fail(new AppError({ cause: err }));
    });
  }),
);
```

---

## Module Structure

```
src/
├── index.ts                    # Public API exports
├── api.ts                      # Core parse/stringify functions
├── config.ts                   # JsonService, Layer, mockBackend
├── schema.ts                   # Schema validation helpers
├── errors.ts                   # Error types (ParseError, etc.)
├── backends/
│   ├── index.ts               # Backend exports
│   ├── json.ts                # JSON backend
│   ├── jsonc.ts               # JSONC backend
│   ├── superjson.ts           # SuperJSON backend
│   └── types.ts               # Backend interface
├── utils/
│   ├── index.ts               # Utility exports
│   └── string.ts              # stripComments, buildSnippet, getLineColumn
├── testing.ts                 # Test utilities (mockBackend export)
└── __tests__/
    ├── unit/backends/         # Backend unit tests
    ├── integration/           # Round-trip tests
    ├── golden.test.ts         # Golden fixture tests
    └── fixtures/              # JSONC test fixtures
        ├── users.jsonc
        ├── complex-types.jsonc
        └── config.jsonc
```

---

## Key Design Patterns (from Effect Patterns)

### 1. Lazy Effects

All operations are lazy (nothing executes until explicitly run):

```typescript
const effect = Json.parse(UserSchema, input); // No execution yet
const user = await Effect.runPromise(effect); // Executes here
```

### 2. Effect.gen for Sequential Logic

```typescript
const parseAndValidate = (schema, input) =>
  Effect.gen(function* () {
    const raw = yield* backend.parse(input);
    const validated = yield* validateAgainstSchema(schema, raw);
    return validated;
  });
```

### 3. Service Tags for DI

```typescript
export class JsonService extends Context.Tag("@effect-json/JsonService")<
  JsonService,
  { /* service interface */ }
>() {}

const JsonServiceLive = JsonService.of({
  parse: (schema, input) => api.parse(schema, input),
  // ... other methods
});

// Usage
effect.pipe(Effect.provideLayer(JsonServiceLive));
```

### 4. Tagged Errors

```typescript
export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly snippet: string;
  readonly cause?: Error;
}> {}

// Recovery
effect.pipe(
  Effect.catchTag("ParseError", (err) => /* handle */),
);
```

### 5. Schema-Driven Validation

```typescript
Schema.decode(schema)(data).pipe(
  Effect.mapError((e) => new ValidationError({ cause: e })),
);
```

### 6. Composability with Pipe

```typescript
parse(UserSchema, input)
  .pipe(
    Effect.map((user) => ({ ...user, updated: true })),
    Effect.tap((user) => Effect.logInfo(`Parsed: ${JSON.stringify(user)}`)),
    Effect.catchTag("ParseError", (e) => Effect.logError(e.message)),
  );
```

---

## Extensibility

### Adding a New Backend

1. **Implement Backend interface** (`src/backends/types.ts`)
2. **Create backend file** (`src/backends/my-backend.ts`)
3. **Export from** `src/backends/index.ts`
4. **Add tests** in `src/__tests__/unit/backends/my-backend.test.ts`
5. **Document** in README and ARCHITECTURE.md

**Example: MessagePack Backend (future)**

```typescript
export const messagepackBackend: Backend = {
  parse: (input) =>
    Effect.try({
      try: () => unpack(Buffer.from(input)),
      catch: (error) => new ParseError({ /* ... */ }),
    }),
  stringify: (value) =>
    Effect.try({
      try: () => pack(value).toString(),
      catch: (error) => new StringifyError({ /* ... */ }),
    }),
};
```

---

## Performance Considerations

- **No unnecessary allocations**: Reuse buffers where possible
- **Lazy parsing**: Only parse on demand (Effects are lazy)
- **Streaming for large payloads**: Future enhancement (Effect.Stream)
- **Caching**: Optional layer-based caching (future)

**Typical performance targets:**
- JSON parse/stringify: <1ms for payloads <100KB
- JSONC: <2ms (comment stripping overhead)
- SuperJSON: <5ms (type preservation overhead)

---

## Testing Strategy

### Test Layers

1. **Unit tests**: Individual backends in isolation (13 JSON, 9 JSONC, 12 SuperJSON)
2. **Integration tests**: Parse + Validate + Stringify round-trips (10 tests)
3. **Golden tests**: JSONC fixtures with expected outputs (users, complex-types, config)
4. **Property tests**: (Future - fast-check)
5. **Performance tests**: (Future - vitest benchmarks)

### Golden Fixtures

Located in `src/__tests__/fixtures/`, written in JSONC for readability:

```jsonc
{
  "test_case_name": {
    "data": { /* ... */ },
    "__metadata": {
      "description": "Human-readable test intent",
      "should_parse": true,
      "should_validate": true,
      "round_trip": true,
      "backends": ["json", "jsonc"],
      "expected_error": "ParseError" // if should_parse: false
    }
  }
}
```

---

## Production Best Practices

### 1. Always Use Schema Validation

```typescript
// ✅ Good - type-safe, validated
const user = await Effect.runPromise(Json.parse(UserSchema, input));

// ❌ Avoid - no validation
const user = JSON.parse(input);
```

### 2. Handle Errors with catchTag

```typescript
const effect = Json.parse(UserSchema, input).pipe(
  Effect.catchTag("ParseError", (err) =>
    Effect.succeed(DEFAULT_USER),
  ),
);
```

### 3. Use DateFromSelf for SuperJSON

```typescript
// For SuperJSON schemas
const SuperJsonSchema = Schema.Struct({
  createdAt: Schema.DateFromSelf, // Not Schema.Date!
});
```

### 4. Provide JsonService for Testing

```typescript
// In tests
const testEffect = effect.pipe(
  Effect.provideLayer(
    JsonService.of({ parse: mockParse, /* ... */ }),
  ),
);
```

---

## Future Enhancements (v2.0+)

- **Streaming JSON**: `Effect.Stream` for large files
- **PKL Backend**: Apple's configuration language
- **MessagePack Backend**: Binary serialization
- **Caching Layer**: Layer-based caching for repeated operations
- **Plugin System**: User-defined backends without forking

---

## Summary

effect-json is architected for:
- **Type safety**: Schema-driven validation at every step
- **Composability**: Effect-native operations compose with pipes
- **Extensibility**: Pluggable backends via clean interface
- **Precision**: Rich error context (line/column, schema paths)
- **Testability**: DI via service tags, mockable backends

All design decisions prioritize clarity, safety, and Effect ecosystem integration.
