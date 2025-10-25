# effect-json

**Type-safe, schema-driven JSON serialization for TypeScript and Effect.**

effect-json provides multiple serialization backends (JSON, JSONC, SuperJSON) unified under a single, Effect-native API with comprehensive error handling and schema validation.

## Features

- 🔒 **Type-safe**: Schema-driven validation using Effect.Schema
- 🎯 **Multiple backends**: JSON (strict), JSONC (with comments), SuperJSON (type-preserving)
- ⚡ **Effect-native**: All operations return Effects for composability
- 📍 **Precise errors**: Line/column information for parse errors, detailed validation errors
- 🧪 **Fully tested**: 84 tests with comprehensive coverage
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

### Stringify Functions

- `stringify(schema, value, options?)` - Stringify to JSON
- `stringifyJsonc(schema, value, options?)` - Stringify to JSON (same as stringify)
- `stringifySuperjson(schema, value, options?)` - Stringify with type metadata

### Error Types

- `ParseError` - JSON parsing failed (includes line/column)
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
- **Testing**: Vitest (84 tests passing)
- **Linting/Formatting**: Biome
- **TypeScript**: Strict mode
- **Effect**: Latest
- **Bundling**: Vite

## Documentation

### Library Documentation

- `packages/effect-json/ARCHITECTURE.md` - Implementation details, patterns, and best practices

### Planning Documentation

See the `/docs` directory for project planning:
- `MRD.md` - Market requirements
- `PRD.md` - Product requirements
- `Architecture.md` - Technical design
- `ImplementationPlan.md` - Development roadmap

## License

MIT
