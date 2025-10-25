# effect-json – Architecture

## High-Level Design

┌─────────────────────────────────────────────────────┐

│                  Public API Layer                   │

│  (parse, stringify, parseJsonc, parseSuperjson)    │

└────────────────┬────────────────────────────────────┘

│

┌────────────────┴────────────────────────────────────┐

│          Configuration & Composition Layer           │

│  (create, withBackend, Layer providers)             │

└────────────────┬────────────────────────────────────┘

│

┌────────────────┴────────────────────────────────────┐

│            Schema Validation Layer                   │

│  (Effect.Schema integration, guards)                │

└────────────────┬────────────────────────────────────┘

│

┌────────────────┴────────────────────────────────────┐

│             Backend Layer                            │
│  ┌──────────────┬──────────────┬──────────────┐    │

│  │ JSON Backend │ JSONC Backend│ SuperJSON    │    │

│  │              │              │ Backend      │    │

│  └──────────────┴──────────────┴──────────────┘    │

└─────────────────────────────────────────────────────┘

---

## Core Layers

### 1. Public API Layer

**Module**: `src/api.ts`

Exports top-level functions:
- `parse(schema, input)`
- `stringify(schema, value, options)`
- `parseJsonc(schema, input)`
- `stringifyJsonc(schema, value, options)`
- `parseSuperjson(schema, input)`
- `stringifySuperjson(schema, value, options)`

**Characteristics:**
- Thin wrapper over configuration + backend execution
- All operations return `Effect<A, ParseError | ValidationError | StringifyError, never>`
- No side effects; pure composition

**Pattern** (from Effect Patterns):
```typescript
export const parse = <A>(
  schema: Schema.Schema<A>,
  input: string | Buffer
): Effect.Effect<A, ParseError, never> =>
  Effect.gen(function* (_) {
    const backend = yield* _(getBackend("json"));
    const raw = yield* _(backend.parse(input));
    const validated = yield* _(
      Schema.decode(schema)(raw).pipe(
        Effect.mapError((e) => new ValidationError({ cause: e }))
      )
    );
    return validated;
  });

  ---

## Core Layers

### 1. Public API Layer

**Module**: `src/api.ts`

Exports top-level functions:
- `parse(schema, input)`
- `stringify(schema, value, options)`
- `parseJsonc(schema, input)`
- `stringifyJsonc(schema, value, options)`
- `parseSuperjson(schema, input)`
- `stringifySuperjson(schema, value, options)`

**Characteristics:**
- Thin wrapper over configuration + backend execution
- All operations return `Effect<A, ParseError | ValidationError | StringifyError, never>`
- No side effects; pure composition

**Pattern** (from Effect Patterns):
```typescript
export const parse = <A>(
  schema: Schema.Schema<A>,
  input: string | Buffer
): Effect.Effect<A, ParseError, never> =>
  Effect.gen(function* (_) {
    const backend = yield* _(getBackend("json"));
    const raw = yield* _(backend.parse(input));
    const validated = yield* _(
      Schema.decode(schema)(raw).pipe(
        Effect.mapError((e) => new ValidationError({ cause: e }))
      )
    );
    return validated;
  });

  4.2 JSONC Backend


Module: src/backends/jsonc.ts

export const jsoncBackend: Backend = {
  parse: (input) => {
    const stripped = stripComments(toString(input));
    return jsonBackend.parse(stripped);
  },

  stringify: (value, options) =>
    jsonBackend.stringify(value, options), // JSONC files are plain JSON when stringified
};

// Helper: strip comments while preserving line/column info
const stripComments = (input: string): string => {
  const result: string[] = [];
  let inString = false;
  let inComment = false;
  let inMultilineComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (!inString && !inComment && !inMultilineComment) {
      if (char === '"' && input[i - 1] !== "\\") {
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
      if (char === '"' && input[i - 1] !== "\\") {
        inString = false;
      }
      result.push(char);
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

**Pattern** (from Effect Patterns - Transform Data During Validation):


- Pre-process input (strip comments) before passing to JSON parser

- Preserve line information for error reporting

4.3 SuperJSON Backend


Module: src/backends/superjson.ts

import { stringify as superjsonStringify, parse as superjsonParse } from "superjson";

export const superjsonBackend: Backend = {
  parse: (input) =>
    Effect.try(() => superjsonParse(toString(input))).pipe(
      Effect.mapError((error) => {
        // SuperJSON parse errors
        return new ParseError({
          message: `SuperJSON parse error: ${error instanceof Error ? error.message : String(error)}`,
          line: 0,
          column: 0,
          snippet: toString(input),
          cause: error instanceof Error ? error : undefined,
        });
      })
    ),

  stringify: (value, options) =>
    Effect.try(() => {
      const stringified = superjsonStringify(value);
      return JSON.stringify(stringified, null, options?.indent ?? 0);
    }).pipe(
      Effect.mapError((error) => {
        const reason =
          error instanceof Error && error.message.includes("cycle")
            ? ("cycle" as const)
            : ("unknown" as const);
        return new StringifyError({
          message: `SuperJSON stringify error: ${error instanceof Error ? error.message : String(error)}`,
          reason,
          cause: error instanceof Error ? error : undefined,
        });
      })
    ),
};

attern (from Effect Patterns - Error Handling with catchTag):


- Wrap third-party library errors in tagged errors

- Maintain error context for debugging

src/
├── index.ts                    # Public API exports
├── api.ts                      # Core parse/stringify functions
├── config.ts                   # Configuration, JsonService
├── schema.ts                   # Schema validation, branded types
├── errors.ts                   # Error types (ParseError, StringifyError, ValidationError)
├── backends/
│   ├── index.ts               # Backend exports
│   ├── json.ts                # JSON backend
│   ├── jsonc.ts               # JSONC backend
│   ├── superjson.ts           # SuperJSON backend
│   └── types.ts               # Backend interface
├── testing/
│   ├── index.ts               # Test utilities
│   ├── mock-backend.ts        # In-memory mock backend
│   └── fixtures.ts            # Golden test fixtures
└── utils/
    ├── index.ts               # Utility exports
    └── string.ts              # String helpers (stripComments, buildSnippet, etc.)

	Key Design Patterns (from Effect Patterns)

1. Lazy Effects

- All operations are lazy (nothing executes until explicitly run)

- Enables composition and testing without side effects

2. Effect.gen for Sequential Logic

const parseAndValidate = (schema, input) =>
  Effect.gen(function* (_) {
    const backend = yield* _(getBackend());
    const raw = yield* _(backend.parse(input));
    const validated = yield* _(validateAgainstSchema(schema, raw));
    return validated;
  });

  3. Layers for DI

	const jsonLayer = Layer.succeed(JsonService, {
	  backend: "json",
	  parse: (schema, input) => parse(schema, input),
	  ...
	});
	
	effect.pipe(Effect.provideLayer(jsonLayer));

4. Tagged Errors

	export class ParseError extends Data.TaggedError<"ParseError"> {
	  readonly line: number;
	  readonly column: number;
	}

5. Schema-Driven Validation

	Schema.decode(schema)(data).pipe(
	  Effect.mapError((e) => new ValidationError({ cause: e }))
	);

	6. Composability with Pipe

	parse(UserSchema, input)
	  .pipe(
	    Effect.map((user) => ({ ...user, updated: true })),
	    Effect.tap((user) => Effect.logInfo(`Parsed: ${JSON.stringify(user)}`)),
	    Effect.catchTag("ParseError", (e) => Effect.logError(e.message))
	  );


---

Error Handling Strategy

Error Taxonomy

	ParseError
	  ├── SyntaxError (JSON syntax invalid)
	  ├── LineColumnInfo (line, column, snippet)
	  └── Cause (original error)
	
	ValidationError
	  ├── SchemaPath (where validation failed)
	  ├── Expected (schema type)
	  ├── Actual (received value)
	  └── Cause (Schema.decode error)
	
	StringifyError
	  ├── Reason ("schema_mismatch" | "type_error" | "cycle" | "unknown")
	  └── Cause (original error)

Error Recovery Pattern

	parse(UserSchema, input).pipe(
	  Effect.catchTag("ParseError", (err) =>
	    // Fallback behavior
	    Effect.succeed(DEFAULT_USER)
	  ),
	  Effect.catchTag("ValidationError", (err) =>
	    // Log and escalate
	    Effect.gen(function* (_) {
	      yield* _(Effect.logError(`Validation failed at ${err.schemaPath}`));
	      yield* _(Effect.fail(new AppError({ cause: err })));
	    })
	  )
	);


---

Testing Architecture

Test Layers

1. Unit tests: Individual backends in isolation

2. Integration tests: Parse + Validate + Stringify round-trips

3. Golden tests: JSONC fixtures with expected outputs

4. Performance tests: Parse/stringify latency benchmarks

Mock Backend for Testing

	export const mockBackend: Backend = {
	  parse: (input) =>
	    Effect.succeed(JSON.parse(toString(input))),
	  stringify: (value) =>
	    Effect.succeed(JSON.stringify(value)),
	};
	
	// Use in tests
	const testEffect = parse(UserSchema, input).pipe(
	  Effect.provideLayer(
	    Layer.succeed(JsonService, { backend: mockBackend, ... })
	  )
	);


---

Extensibility

Adding a New Backend

1. Implement Backend interface

2. Add to src/backends/

3. Export from src/backends/index.ts

4. Add tests in src/backends/__tests__/

5. Document in README

Example: Adding a MessagePack backend (future)


	export const messagepackBackend: Backend = {
	  parse: (input) =>
	    Effect.try(() => unpack(Buffer.from(input))).pipe(
	      Effect.mapError((error) => new ParseError({ cause: error }))
	    ),
	  stringify: (value) =>
	    Effect.try(() => pack(value)).pipe(
	      Effect.mapError((error) => new StringifyError({ reason: "unknown", cause: error }))
	    ),
	};

	Performance Considerations

- No unnecessary allocations: Reuse buffers where possible

- Lazy parsing: Only parse on demand (Effects)

- Streaming for large payloads: Future enhancement

- Caching: Optional Layer-based caching (future)

Typical performance targets:


- JSON parse/stringify <1ms for payloads <100KB

- JSONC <2ms (comment stripping overhead)

- SuperJSON <5ms (type preservation overhead)

---

## 4. TESTING_PLAN.md (Test Strategy)

````markdown
# effect-json – Testing Plan

## Testing Philosophy

**"Tests are executable specifications."**

All tests:
- Are written in Effect, using Effect.gen
- Use golden fixtures (JSONC format) for clarity
- Run deterministically (no real I/O, mocked backends)
- Are agent-parseable (clear patterns, consistent structure)

---

## Test Hierarchy

### 1. Unit Tests (60% coverage)

**Goal**: Verify individual functions in isolation.

**Scope**:
- Backend implementations (JSON, JSONC, SuperJSON)
- Error construction and formatting
- Utility functions (stripComments, buildSnippet, etc.)
- Schema validation guards

**Example**:
```typescript
// src/backends/__tests__/json.test.ts
import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { jsonBackend } from "../json";
import { ParseError } from "../../errors";

describe("jsonBackend", () => {
  describe("parse", () => {
    it("should parse valid JSON", async () => {
      const effect = jsonBackend.parse('{"id": 1, "name": "Paul"}');
      const result = await Effect.runPromise(effect);
      expect(result).toEqual({ id: 1, name: "Paul" });
    });

    it("should return ParseError with line/column on syntax error", async () => {
      const effect = jsonBackend.parse('{"id": 1, invalid}');
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        const error = result.left;
        expect(error).toBeInstanceOf(ParseError);
        expect(error.line).toBeGreaterThan(0);
        expect(error.column).toBeGreaterThan(0);
        expect(error.snippet).toContain("invalid");
      }
    });

    it("should handle empty input", async () => {
      const effect = jsonBackend.parse("");
      const result = await Effect.runPromise(Effect.either(effect));
      expect(result._tag).toBe("Left");
    });
  });

  describe("stringify", () => {
    it("should stringify objects with indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsonBackend.stringify(value, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain('\n');
      expect(result).toContain('"id"');
    });

    it("should detect circular references", async () => {
      const circular: any = { id: 1 };
      circular.self = circular;

      const effect = jsonBackend.stringify(circular);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.reason).toBe("cycle");
      }
    });
  });
});

---

## 4. TESTING_PLAN.md (Test Strategy)

````markdown
# effect-json – Testing Plan

## Testing Philosophy

**"Tests are executable specifications."**

All tests:
- Are written in Effect, using Effect.gen
- Use golden fixtures (JSONC format) for clarity
- Run deterministically (no real I/O, mocked backends)
- Are agent-parseable (clear patterns, consistent structure)

---

## Test Hierarchy

### 1. Unit Tests (60% coverage)

**Goal**: Verify individual functions in isolation.

**Scope**:
- Backend implementations (JSON, JSONC, SuperJSON)
- Error construction and formatting
- Utility functions (stripComments, buildSnippet, etc.)
- Schema validation guards

**Example**:
```typescript
// src/backends/__tests__/json.test.ts
import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { jsonBackend } from "../json";
import { ParseError } from "../../errors";

describe("jsonBackend", () => {
  describe("parse", () => {
    it("should parse valid JSON", async () => {
      const effect = jsonBackend.parse('{"id": 1, "name": "Paul"}');
      const result = await Effect.runPromise(effect);
      expect(result).toEqual({ id: 1, name: "Paul" });
    });

    it("should return ParseError with line/column on syntax error", async () => {
      const effect = jsonBackend.parse('{"id": 1, invalid}');
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        const error = result.left;
        expect(error).toBeInstanceOf(ParseError);
        expect(error.line).toBeGreaterThan(0);
        expect(error.column).toBeGreaterThan(0);
        expect(error.snippet).toContain("invalid");
      }
    });

    it("should handle empty input", async () => {
      const effect = jsonBackend.parse("");
      const result = await Effect.runPromise(Effect.either(effect));
      expect(result._tag).toBe("Left");
    });
  });

  describe("stringify", () => {
    it("should stringify objects with indentation", async () => {
      const value = { id: 1, name: "Paul" };
      const effect = jsonBackend.stringify(value, { indent: 2 });
      const result = await Effect.runPromise(effect);

      expect(result).toContain('\n');
      expect(result).toContain('"id"');
    });

    it("should detect circular references", async () => {
      const circular: any = { id: 1 };
      circular.self = circular;

      const effect = jsonBackend.stringify(circular);
      const result = await Effect.runPromise(Effect.either(effect));

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left.reason).toBe("cycle");
      }
    });
  });
});

2. Integration Tests (25% coverage)


Goal: Verify parse + validate + stringify workflows.

Scope:


- Full pipeline: input → parse → validate → output

- Schema validation integration

- Round-trip guarantees

- Error propagation across layers

Example:


	// src/__tests__/integration.test.ts
	import { describe, it, expect } from "vitest";
	import { Effect, Schema } from "effect";
	import { Json } from "../index";
	import { ValidationError } from "../errors";
	
	const UserSchema = Schema.Struct({
	  id: Schema.Number,
	  name: Schema.String,
	  email: Schema.String,
	});
	
	describe("Parse → Validate → Stringify", () => {
	  it("should parse, validate, and round-trip a user", async () => {
	    const input = '{"id": 1, "name": "Paul", "email": "paul@example.com"}';
	
	    const effect = Effect.gen(function* (_) {
	      const parsed = yield* _(Json.parse(UserSchema, input));
	      const stringified = yield* _(Json.stringify(UserSchema, parsed));
	      const reparsed = yield* _(Json.parse(UserSchema, stringified));
	
	      return { original: parsed, roundtrip: reparsed };
	    });
	
	    const result = await Effect.runPromise(effect);
	
	    expect(result.original).toEqual(result.roundtrip);
	  });
	
	  it("should fail on schema mismatch", async () => {
	    const input = '{"id": "not-a-number", "name": "Paul", "email": "paul@example.com"}';
	
	    const effect = Json.parse(UserSchema, input);
	    const result = await Effect.runPromise(Effect.either(effect));
	
	    expect(result._tag).toBe("Left");
	    if (result._tag === "Left") {
	      expect(result.left).toBeInstanceOf(ValidationError);
	    }
	  });
	});

3. Golden Tests (10% coverage)


Goal: Validate against known-good fixtures and expected outputs.

Format: JSONC for readability and comments.

Fixtures:


	src/__tests__/fixtures/
	├── users.jsonc                  # Sample users (with comments)
	├── complex-types.jsonc          # Date, Set, Map, BigInt
	├── invalid-json.jsonc           # Parse errors (with expected error info)
	└── edge-cases.jsonc             # Empty, null, large payloads
	```
	
	**Example Fixture** (`users.jsonc`):
	```jsonc
	{
	  // Valid user entry
	  "valid_user": {
	    "id": 1,
	    "name": "Paul",
	    "email": "paul@example.com",
	    // Metadata for test: expected to parse and validate
	    "__metadata": {
	      "should_parse": true,
	      "should_validate": true,
	      "round_trip": true
	    }
	  },
	
	  // Invalid: missing required field
	  "missing_email": {
	    "id": 2,
	    "name": "Jane",
	    // Note: email is intentionally missing
	    "__metadata": {
	      "should_parse": true,
	      "should_validate": false,
	      "expected_error": "ValidationError"
	    }
	  }
	}
	```
	
	**Test**:
	```typescript
	// src/__tests__/golden.test.ts
	import { describe, it, expect } from "vitest";
	import { Effect } from "effect";
	import { Json } from "../index";
	import fixtures from "./fixtures/users.jsonc";
	
	describe("Golden Tests", () => {
	  Object.entries(fixtures).forEach(([name, fixture]) => {
	    it(`should handle fixture: ${name}`, async () => {
	      const { data, __metadata } = fixture;
	      const effect = Json.parse(UserSchema, JSON.stringify(data));
	
	      if (__metadata.should_validate) {
	        const result = await Effect.runPromise(effect);
	        expect(result).toBeDefined();
	
	        if (__metadata.round_trip) {
	          const stringified = await Effect.runPromise(
	            Json.stringify(UserSchema, result)
	          );
	          const reparsed = await Effect.runPromise(
	            Json.parse(UserSchema, stringified)
	          );
	          expect(result).toEqual(reparsed);
	        }
	      } else {
	        const result = await Effect.runPromise(Effect.either(effect));
	        expect(result._tag).toBe("Left");
	        if (result._tag === "Left") {
	          expect(result.left.constructor.name).toBe(
	            __metadata.expected_error
	          );
	        }
	      }
	    });
	  });
	});
	```
	
	### 4. Property-Based Tests (5% coverage)
	
	**Goal**: Verify invariants hold across random inputs.
	
	**Tool**: `@fast-check/effect` (or similar)
	
	**Example**:
	```typescript
	// src/__tests__/properties.test.ts
	import { describe, it } from "vitest";
	import * as fc from "fast-check";
	import { Json } from "../index";
	import { UserSchema } from "./fixtures";
	
	describe("Property-Based Tests", () => {
	  it("should parse valid JSON and preserve round-trip", () => {
	    fc.assert(
	      fc.asyncProperty(
	        fc.object({ depthSize: "small" }),
	        async (value) => {
	          const stringified = await Effect.runPromise(
	            Json.stringify(Schema.Unknown, value)
	          );
	          const reparsed = await Effect.runPromise(
	            Json.parse(Schema.Unknown, stringified)
	          );
	
	          // Structural equality (via Data.equals)
	          return Data.equals(value, reparsed);
	        }
	      )
	    );
	  });
	});
	```
	
	### 5. Performance Tests (Optional, for v1.1)
	
	**Goal**: Verify performance targets are met.
	
	**Tool**: `vitest` benchmarks or `tinybench`
	
	```typescript
	// src/__tests__/performance.test.ts
	import { bench, describe } from "vitest";
	import { Effect } from "effect";
	import { Json } from "../index";
	
	describe("Performance Benchmarks", () => {
	  bench("parse 100KB JSON", async () => {
	    const largeJson = generateJsonOfSize(100_000);
	    await Effect.runPromise(Json.parse(Schema.Unknown, largeJson));
	  });
	
	  bench("stringify 10k objects", async () => {
	    const objects = Array.from({ length: 10_000 }, () => ({
	      id: Math.random(),
	      name: "test",
	    }));
	    await Effect.runPromise(Json.stringify(Schema.Unknown, objects));
	  });
	});
	```
	
	---
	
	## Test Coverage Targets
	
	| Category | Target | Rationale |
	|----------|--------|-----------|
	| Unit | 60% | Core backend logic |
	| Integration | 25% | Workflows and layer composition |
	| Golden | 10% | Known-good fixtures |
	| Property | 5% | Invariant verification |
	
	**Overall target**: ≥90% code coverage
	
	---
	
	## Test File Organization
	
	```
	src/
	├── __tests__/
	│   ├── unit/
	│   │   ├── backends/
	│   │   │   ├── json.test.ts
	│   │   │   ├── jsonc.test.ts
	│   │   │   └── superjson.test.ts
	│   │   ├── errors.test.ts
	│   │   └── schema.test.ts
	│   ├── integration/
	│   │   ├── parse-validate-stringify.test.ts
	│   │   ├── layers.test.ts
	│   │   └── error-recovery.test.ts
	│   ├── golden.test.ts
	│   ├── properties.test.ts
	│   ├── fixtures/
	│   │   ├── users.jsonc
	│   │   ├── complex-types.jsonc
	│   │   └── invalid-json.jsonc
	│   └── setup.ts
	```
	
	---
	
	## Test Setup & Configuration
	
	**`vitest.config.ts`** (at monorepo root):
	```typescript
	import { defineConfig } from "vitest/config";
	
	export default defineConfig({
	  test: {
	    globals: true,
	    environment: "node",
	    coverage: {
	      provider: "v8",
	      reporter: ["text", "json", "html"],
	      all: true,
	      lines: 90,
	      functions: 90,
	      branches: 90,
	      statements: 90,
	    },
	  },
	});
	```
	
	**`src/__tests__/setup.ts`**:
	```typescript
	import { Effect } from "effect";
	
	// Extend Vitest matchers for Effect
	expect.extend({
	  async toSucceedWith(received: Effect.Effect<any, any>, expected: any) {
	    const result = await Effect.runPromise(Effect.either(received));
	    return {
	      pass: result._tag === "Right" && result.right === expected,
	      message: () =>
	        `Expected effect to succeed with ${expected}, but got ${result}`,
	    };
	  },
	});
	```
	
	---
	
	## Running Tests
	
	```bash
	# Run all tests
	bun test
	
	# Run with coverage
	bun test --coverage
	
	# Run specific suite
	bun test src/__tests__/unit/backends
	
	# Watch mode
	bun test --watch
	
	# UI mode
	bun test --ui
	```
	
	---
	
	## Test Patterns & Best Practices
	
	### 1. Always Use `Effect.either` for Error Cases
	```typescript
	const result = await Effect.runPromise(Effect.either(effect));
	expect(result._tag).toBe("Left");
	```
	
	### 2. Use `Effect.gen` for Sequential Test Logic
	```typescript
	const effect = Effect.gen(function* (_) {
	  const parsed = yield* _(Json.parse(schema, input));
	  const stringified = yield* _(Json.stringify(schema, parsed));
	  return { parsed, stringified };
	});
	```
	
	### 3. Use JSONC Fixtures for Golden Tests
	```jsonc
	{
	  "test_case": {
	    "input": { /* ... */ },
	    "expected": { /* ... */ },
	    // Comments explain the test intent
	  }
	}
	```
	
	### 4. Name Tests Descriptively
	```typescript
	it("should parse valid JSON and preserve round-trip", () => {});
	it("should fail with line/column info on syntax error", () => {});
	it("should reject when schema validation fails", () => {});
	```
	
	### 5. Test Both Happy Path and Error Cases
	```typescript
	describe("Json.parse", () => {
	  it("parses valid input", () => { /* happy path */ });
	  it("fails on syntax error", () => { /* error case */ });
	  it("fails on validation error", () => { /* error case */ });
	});
	```
	
	---
	
	## Continuous Integration
	
	**`.github/workflows/test.yml`** (will be generated):
	```yaml
	name: Tests
	
	on: [push, pull_request]
	
	jobs:
	  test:
	    runs-on: ubuntu-latest
	    steps:
	      - uses: actions/checkout@v3
	      - uses: oven-sh/setup-bun@v1
	      - run: bun install
	      - run: bun test
	      - run: bun test --coverage
	      - uses: codecov/codecov-action@v3
	        with:
	          files: ./coverage/coverage-final.json
	```
	
	---
	
	## Test Maintenance
	
	- **Review golden fixtures quarterly**: Ensure they reflect current patterns and edge cases
	- **Update property tests if new invariants discovered**: Keep property tests current with domain knowledge
	- **Monitor coverage trends**: Maintain ≥90% coverage as code evolves
	- **Add tests for all bugs fixed**: Regression prevention
	```
	
	---
	
	## 5. IMPLEMENTATION_PLAN.md (Phased Rollout)
	
	```markdown
	# effect-json – Implementation Plan
	
	## Overview
	
	**effect-json** will be built in three phases, each with clear deliverables, success criteria, and integration points.
	
	---
	
	## Phase 1: Core Library (Weeks 1-2)
	
	### Deliverables
	- [ ] Project structure (Turborepo, Bun setup, Biome config)
	- [ ] JSON backend (parse, stringify, error handling)
	- [ ] JSONC backend (comment stripping)
	- [ ] Error types (ParseError, ValidationError, StringifyError)
	- [ ] Public API (parse, stringify, parseJsonc, stringifyJsonc)
	- [ ] Schema validation layer integration
	- [ ] Unit tests for backends (≥70% coverage)
	- [ ] README with quick start and API overview
	
	### Key Files to Create
	```
	effect-json/
	├── tsconfig.json
	├── package.json
	├── biome.jsonc
	├── vitest.config.ts
	├── src/
	│   ├── index.ts
	│   ├── api.ts
	│   ├── config.ts
	│   ├── errors.ts
	│   ├── backends/
	│   │   ├── index.ts
	│   │   ├── json.ts
	│   │   ├── jsonc.ts
	│   │   └── types.ts
	│   ├── utils/
	│   │   ├── index.ts
	│   │   └── string.ts (stripComments, buildSnippet)
	│   └── __tests__/
	│       ├── unit/
	│       │   ├── backends/
	│       │   │   ├── json.test.ts
	│       │   │   └── jsonc.test.ts
	│       │   └── errors.test.ts
	│       └── fixtures/
	└── README.md
	```
	
	### Success Criteria
	- [ ] `bun test` passes with ≥70% coverage
	- [ ] No TypeScript errors
	- [ ] JSON and JSONC parse/stringify work end-to-end
	- [ ] Error messages include line/column for JSON
	- [ ] README demonstrates basic usage
	
	### Agent Tasks
	1. **Setup**: Initialize Turborepo, Biome, TypeScript, Effect
	2. **Backends**: Implement JSON backend with error handling
	3. **JSONC**: Implement comment stripping logic
	4. **API**: Export public parse/stringify functions
	5. **Tests**: Unit tests for backends
	6. **Docs**: Basic README
	
	---
	
	## Phase 2: SuperJSON & Polish (Weeks 3-4)
	
	### Deliverables
	- [ ] SuperJSON backend (parse, stringify, type preservation)
	- [ ] Round-trip guarantee tests (golden fixtures in JSONC)
	- [ ] Configuration system (JsonService, Layer-based DI)
	- [ ] Integration tests (parse + validate + stringify workflows)
	- [ ] Error recovery patterns (catchTag, orElse)
	- [ ] Performance benchmarks (optional, stretch goal)
	- [ ] ARCHITECTURE.md and extended API docs
	
	### Key Files to Add/Modify
	```
	src/
	├── backends/
	│   ├── superjson.ts         # New
	│   └── types.ts             # Update with Backend interface
	├── config.ts                # New (JsonService, Layer, create)
	├── schema.ts                # New (validation helpers)
	├── __tests__/
	│   ├── integration/         # New folder
	│   │   └── roundtrip.test.ts
	│   ├── golden.test.ts       # New
	│   ├── fixtures/
	│   │   ├── users.jsonc      # New
	│   │   └── complex.jsonc    # New (Date, Set, Map, BigInt)
	│   └── setup.ts             # New (test utilities)
	└── utils/
	    └── superjson-helper.ts  # New (if needed)
	```
	
	### Success Criteria
	- [ ] `bun test` passes with ≥90% coverage
	- [ ] No TypeScript errors or warnings
	- [ ] Round-trip guarantee verified with golden fixtures
	- [ ] JsonService with DI working (Effect.Layer pattern)
	- [ ] Integration tests validate full workflows
	- [ ] ARCHITECTURE.md documents design decisions
	
	### Agent Tasks
	1. **SuperJSON**: Implement backend with type preservation
	2. **Configuration**: Create JsonService and Layer-based DI
	3. **Validation**: Schema integration helpers
	4. **Golden tests**: Write fixtures (JSONC) and validation tests
	5. **Integration**: Parse → validate → stringify workflows
	6. **Docs**: Write ARCHITECTURE.md
	
	---
	
	## Phase 3: Integration & Release (Weeks 5-6)
	
	### Deliverables
	- [ ] Integrate into effect-env (use effect-json for config parsing)
	- [ ] Integrate into effect-xstate (use effect-json for actor state)
	- [ ] Final documentation and examples
	- [ ] Performance optimization (if needed)
	- [ ] Publish to npm
	- [ ] Announce and gather community feedback
	
	### Key Files to Add/Update
	```
	# In effect-json:
	├── README.md                      # Update with examples
	├── docs/
	│   ├── API.md                     # Comprehensive API reference
	│   ├── PATTERNS.md                # Usage patterns (Effect, DI)
	│   └── EXAMPLES.md                # Real-world examples
	└── examples/
	    ├── parse-config.ts            # Config parsing (for effect-env)
	    ├── actor-state.ts             # Actor state (for effect-xstate)
	    └── error-recovery.ts          # Error handling patterns
	
	# In effect-env:
	├── src/
	│   └── config/
	│       └── parser.ts              # Use Json.parseJsonc for config
	
	# In effect-xstate:
	├── src/
	│   └── providers/
	│       └── fs-superjson-provider.ts # Use Json.stringifySuperjson
	```
	
	### Success Criteria
	- [ ] effect-env uses effect-json for config parsing
	- [ ] effect-xstate uses effect-json for actor persistence
	- [ ] All integration tests pass
	- [ ] Package published to npm with versions tagged
	- [ ] Community feedback collected and prioritized
	
	### Agent Tasks
	1. **effect-env integration**: Replace config parsing with Json.parseJsonc
	2. **effect-xstate integration**: Add fs-superjson-provider using effect-json
	3. **Documentation**: Write comprehensive examples and patterns
	4. **Release**: Prepare CHANGELOG, tag version, publish
	5. **Feedback**: Monitor issues and collect community input
	
	---
	
	## Rollout Timeline
	
	| Phase | Duration | Start | End | Lead | Status |
	|-------|----------|-------|-----|------|--------|
	| Phase 1: Core | 2 weeks | Week 1 | Week 2 | Agent | ⏳ To Do |
	| Phase 2: Polish | 2 weeks | Week 3 | Week 4 | Agent | ⏳ To Do |
	| Phase 3: Integration | 2 weeks | Week 5 | Week 6 | Paul + Agent | ⏳ To Do |
	
	---
	
	## Dependencies & Blockers
	
	| Dependency | Status | Impact |
	|-----------|--------|--------|
	| Turborepo setup | Ready | Phase 1 |
	| Effect.Schema | Ready | All phases |
	| Bun + Vitest | Ready | All phases |
	| effect-env | Ready | Phase 3 |
	| effect-xstate | Design | Phase 3 |
	
	---
	
	## Rollback Plan
	
	- **Phase 1 issues**: Restart with simplified backend (JSON only, minimal error handling)
	- **Phase 2 issues**: Defer SuperJSON to Phase 3; release JSON + JSONC as v1.0
	- **Phase 3 issues**: Release libraries independently; delay ecosystem integration
	
	---
	
	## Success Metrics (Post-Launch)
	
	- [ ] Zero boilerplate `safeParseJson` across effect ecosystem
	- [ ] effect-json published with ≥100 npm weekly downloads (month 1)
	- [ ] ≥5 community stars/contributions (month 2)
	- [ ] Used by at least 2 external projects (month 3)
	- [ ] ≥90% test coverage maintained (ongoing)
	
	---
	
	## Post-Launch Roadmap
	
	### v1.1 (Month 2-3)
	- Performance optimization
	- Additional error context (hints, suggestions)
	- Community feedback integration
	- Extended examples and tutorials
	
	### v2.0 (Month 4-6)
	- PKL backend (Apple's configuration language)
	- MessagePack backend
	- Streaming JSON support (for large files)
	- Plugin/extension system
	
	### Future (Beyond 6 months)
	- Integration with more Effect ecosystem projects
	- IDE plugins for JSONC editing
	- Testing utilities for JSON-heavy workflows
	```
	
	---
	
	## Summary
	
	I've created all five documents for **effect-json**:
	
	1. **MRD.md** – Market positioning, personas (Paul, TS teams, agents, infrastructure devs), scope, and success criteria
	2. **PRD.md** – Detailed capabilities (parse, stringify, backends, error handling), non-functional requirements, and roadmap
	3. **ARCHITECTURE.md** – Layered design, module structure, Effect patterns used, error taxonomy, extensibility
	4. **TESTING_PLAN.md** – Test hierarchy (unit, integration, golden, property-based), file organization, patterns
	5. **IMPLEMENTATION_PLAN.md** – Three-phase rollout (Core → Polish → Integration), timeline, success metrics
	
	All docs are:
	- ✅ Agent-parseable (clear structure, executable patterns, concrete examples)
	- ✅ Dev-scannable (TL;DR sections, tables, clear sections)
	- ✅ Aligned with Effect Patterns (Schema, Layers, gen, tagged errors, pipe composition)
	- ✅ Ready to check into the repo and guide implementation
	
	You can now:
	1. Review the docs
	2. Set up the monorepo
	3. Check these into the repo
	4. Have agents begin Phase 1 implementation
	
	Ready to proceed?