# effect-json

[![CI](https://github.com/PaulJPhilp/effect-json/actions/workflows/ci.yml/badge.svg)](https://github.com/PaulJPhilp/effect-json/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/effect-json.svg)](https://www.npmjs.com/package/effect-json)
[![codecov](https://codecov.io/gh/PaulJPhilp/effect-json/branch/main/graph/badge.svg)](https://codecov.io/gh/PaulJPhilp/effect-json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Type-safe, schema-driven JSON serialization for TypeScript and Effect.**

effect-json provides multiple serialization backends (JSON, JSONC, SuperJSON, JSON Lines) unified under a single, Effect-native API with comprehensive error handling and schema validation.

> **Status**: Production ready • Published on npm • v0.1.0

## Features

- 🔒 **Type-safe**: Schema-driven validation using Effect.Schema
- 🎯 **Multiple backends**: JSON (strict), JSONC (with comments), SuperJSON (type-preserving), JSON Lines (streaming/batch), TOON (experimental)
- ⚡ **Effect-native**: All operations return Effects for composability
- 📍 **Precise errors**: Line/column information for parse errors, detailed validation errors
- 🧪 **Fully tested**: 136 tests with comprehensive coverage
- 🔌 **Pluggable**: Extensible backend system

## Installation

```bash
bun add effect-json effect

# Optional: For SuperJSON support
bun add superjson
```

## Quick Start

### Basic JSON Parsing

```typescript
import { Schema, Effect } from "effect";
import * as Json from "effect-json";

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
});

const jsonString = '{"id": 1, "name": "Paul", "email": "paul@example.com"}';

const effect = Json.parse(UserSchema, jsonString);
const user = await Effect.runPromise(effect);
// { id: 1, name: "Paul", email: "paul@example.com" }
```

### JSONC (JSON with Comments)

```typescript
const jsonc = `
{
  // User ID (required)
  "id": 1,
  /* User information */
  "name": "Paul",
  "email": "paul@example.com" // Contact email
}
`;

const effect = Json.parseJsonc(UserSchema, jsonc);
const user = await Effect.runPromise(effect);
```

### SuperJSON (Type-Preserving)

```typescript
const ComplexSchema = Schema.Struct({
  id: Schema.Number,
  createdAt: Schema.DateFromSelf,
  tags: Schema.Array(Schema.String),
});

const data = {
  id: 1,
  createdAt: new Date("2025-01-01"),
  tags: ["typescript", "effect"],
};

// Stringify with type preservation
const stringified = await Effect.runPromise(
  Json.stringifySuperjson(ComplexSchema, data)
);

// Parse back with Date as Date (not string)
const reparsed = await Effect.runPromise(
  Json.parseSuperjson(ComplexSchema, stringified)
);
// reparsed.createdAt is a Date object
```

### TOON Backend (Experimental)

TOON is a compact, human-readable encoding of the JSON data model, optimized for LLM prompts and responses.

> **Note**: The TOON integration is **experimental** and subject to change as the TOON specification and ecosystem evolve.

```typescript
import { Effect, Schema } from "effect";
import { parseToon, stringifyToon } from "effect-json/Toon";

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  tags: Schema.Array(Schema.String)
});

type User = Schema.Schema.Type<typeof User>;

const user: User = {
  id: 1,
  name: "Alice",
  tags: ["admin", "beta"]
};

// Domain type -> TOON string
const program = stringifyToon(User, user).pipe(
  Effect.tap((toon) => Effect.log("TOON:", toon)),
  Effect.flatMap((toon) => parseToon(User, toon)), // TOON string -> domain type
);

// Run with your Effect runtime...
await Effect.runPromise(program);
```

### JSON Lines (JSONL/NDJSON)

JSON Lines is a format for storing structured data where each line is a valid JSON value. It's commonly used for logs, event streams, and LLM training datasets.

#### Batch API (Arrays)

```typescript
import { Effect, Schema } from "effect";
import { parseJsonLines, stringifyJsonLines } from "effect-json/JsonLines";

const Event = Schema.Struct({
  id: Schema.String,
  level: Schema.Literal("info", "warn", "error"),
  message: Schema.String
});

const events = [
  { id: "1", level: "info" as const, message: "Started" },
  { id: "2", level: "error" as const, message: "Boom" }
];

const program = stringifyJsonLines(Event, events).pipe(
  Effect.tap((jsonl) => Effect.log("JSONL:\n" + jsonl)),
  Effect.flatMap((jsonl) => parseJsonLines(Event, jsonl)),
  Effect.tap((parsed) => Effect.log("Parsed:", parsed))
);

await Effect.runPromise(program);
// Output:
// JSONL:
// {"id":"1","level":"info","message":"Started"}
// {"id":"2","level":"error","message":"Boom"}
```

#### Streaming API (Large Files)

```typescript
import { Stream } from "effect";
import { streamParseJsonLines, streamStringifyJsonLines } from "effect-json/JsonLines";

// Parse stream of JSONL chunks (handles arbitrary chunk splits)
const jsonlChunks = Stream.fromIterable([
  '{"id":"1","level":"info","message":"Started"}\n{"id":"',
  '2","level":"error","message":"Boom"}\n'
]);

const parsedEvents = streamParseJsonLines(Event, jsonlChunks);

const program = parsedEvents.pipe(
  Stream.tap((e) => Stream.fromEffect(Effect.log("Event:", e))),
  Stream.runCollect
);

await Effect.runPromise(program);
```

```

### Error Handling

effect-json uses Effect's powerful error handling capabilities. All functions return `Effect<Success, Error>` which you can handle using:

#### Using Effect.runPromise (Recommended)

```typescript
// Simple case - let errors throw
const user = await Effect.runPromise(Json.parse(UserSchema, jsonString));

// Handle errors explicitly with Effect.either
const result = await Effect.runPromise(
  Effect.either(Json.parse(UserSchema, badJson))
);

if (result._tag === "Left") {
  const error = result.left;
  console.log(error.message);   // Parse error details
  console.log(error.line);      // Line number
  console.log(error.column);    // Column number
  console.log(error.snippet);   // Code snippet with pointer
}
```

#### Using catchTag for Specific Errors

```typescript
const effect = Json.parse(UserSchema, badJson).pipe(
  Effect.catchTag("ParseError", (error) => {
    console.error(`Parse failed at ${error.line}:${error.column}`);
    return Effect.succeed(DEFAULT_USER);
  }),
  Effect.catchTag("ValidationError", (error) => {
    console.error(`Validation failed: ${error.message}`);
    return Effect.succeed(DEFAULT_USER);
  }),
);

const user = await Effect.runPromise(effect);
```

#### Fallback Strategies with orElse

```typescript
const effect = Effect.orElse(
  Json.parse(UserSchema, jsonString),       // Try JSON first
  () => Json.parseJsonc(UserSchema, jsonString)  // Fallback to JSONC
);

const user = await Effect.runPromise(effect);
```

> **Why no `parseSync()`?** effect-json is designed to work seamlessly with Effect's ecosystem. Using `Effect.runPromise` ensures proper error handling, composability, and integration with Effect's runtime. For synchronous needs, simply `await Effect.runPromise(...)` - it's concise and idiomatic.

## API

### Parsing Functions

- `parse(schema, input)` - Parse JSON with schema validation
- `parseJsonc(schema, input)` - Parse JSONC (strips comments)
- `parseSuperjson(schema, input)` - Parse SuperJSON with type preservation
- `parseToon(schema, input)` - Parse TOON string (experimental)
- `parseJsonLines(schema, input)` - Parse JSON Lines (JSONL/NDJSON) batch
- `streamParseJsonLines(schema, inputStream)` - Parse JSON Lines stream

### Stringify Functions

- `stringify(schema, value, options?)` - Stringify to JSON
- `stringifyJsonc(schema, value, options?)` - Stringify to JSON (same as stringify)
- `stringifySuperjson(schema, value, options?)` - Stringify with type metadata
- `stringifyToon(schema, value, options?)` - Stringify to TOON (experimental)
- `stringifyJsonLines(schema, values, options?)` - Stringify array to JSON Lines
- `streamStringifyJsonLines(schema, valuesStream, options?)` - Stringify stream to JSON Lines

### Error Types

- `ParseError` - JSON parsing failed (includes line/column)
- `JsonLinesParseError` - JSON Lines parsing failed (includes line number)
- `ValidationError` - Schema validation failed
- `StringifyError` - Stringification failed (e.g., circular references)

## Development

### Project Structure

```
packages/effect-json/
├── src/
│   ├── index.ts           # Public API
│   ├── api.ts             # Core functions
│   ├── backends/          # JSON, JSONC, SuperJSON
│   ├── errors.ts          # Error types
│   └── __tests__/         # Test suites
```

### Commands

```bash
# Install dependencies
bun install

# Build
bun run build

# Test
bun run test
bun run test:watch
bun run test:coverage

# Lint & Format
bun run check

# Type check
bun run typecheck
```

## Tech Stack

- **Runtime**: Bun
- **Monorepo**: Turborepo
- **Testing**: Vitest (136 tests, 85%+ coverage)
- **Linting/Formatting**: Biome
- **TypeScript**: Strict mode
- **Effect**: Latest
- **Bundling**: Vite
- **CI/CD**: GitHub Actions (multi-platform testing, automated releases)

## Documentation

### Library Documentation

- `packages/effect-json/ARCHITECTURE.md` - Implementation details, patterns, and best practices

### Planning Documentation

See the `/docs` directory for project planning:
- `MRD.md` - Market requirements
- `PRD.md` - Product requirements
- `Architecture.md` - Technical design
- `ImplementationPlan.md` - Development roadmap

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our development process, coding standards, and how to submit pull requests.

### Quick Start for Contributors

```bash
# Clone the repository
git clone https://github.com/PaulJPhilp/effect-json.git
cd effect-json

# Install dependencies
bun install

# Run tests
bun test

# Run linting
bun run check

# Build
bun run build
```

See [CLAUDE.md](CLAUDE.md) for detailed development guidelines and architecture information.

## Security

Security issues should be reported privately. See our [Security Policy](SECURITY.md) for details.

## License

MIT © [Paul J. Philp](https://github.com/PaulJPhilp)

## Links

- **npm Package**: https://www.npmjs.com/package/effect-json
- **GitHub Repository**: https://github.com/PaulJPhilp/effect-json
- **Issue Tracker**: https://github.com/PaulJPhilp/effect-json/issues
- **Discussions**: https://github.com/PaulJPhilp/effect-json/discussions
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

Built with ❤️ using [Effect](https://effect.website) and [Bun](https://bun.sh)
