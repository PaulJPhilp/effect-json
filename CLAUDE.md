---
description: Development guidelines and context for effect-json library
globs: "*.ts, *.tsx, *.md, package.json"
alwaysApply: true
---

# effect-json Development Guide

**effect-json** is a published npm library providing type-safe, schema-driven JSON serialization for TypeScript and Effect.

📦 Published: https://www.npmjs.com/package/effect-json
🐙 Repository: https://github.com/PaulJPhilp/effect-json
📊 Version: 0.1.0 (production)

## Project Overview

effect-json provides three JSON serialization backends unified under a single Effect-native API:
- **JSON**: Standard JSON.parse/stringify with precise error reporting
- **JSONC**: JSON with Comments support (strips single-line and multi-line comments)
- **SuperJSON**: Type-preserving serialization (Date, Set, Map, BigInt, etc.)

All operations return Effect types for composability with the Effect ecosystem.

## Architecture

### Core Principles

1. **Effect-First Design**: All APIs return `Effect<Success, Error>` types
2. **Tagged Errors**: Use `ParseError`, `ValidationError`, `StringifyError` for precise error handling
3. **Schema Validation**: Effect.Schema for all parsing/stringification
4. **Pluggable Backends**: Backend interface allows extensibility
5. **Type Safety**: TypeScript strict mode, full type inference

### Project Structure

```
effect-json/
├── packages/effect-json/          # Main package
│   ├── src/
│   │   ├── api.ts                 # Public API (parse, stringify, etc.)
│   │   ├── backends/              # JSON, JSONC, SuperJSON implementations
│   │   │   ├── types.ts           # Backend interface
│   │   │   ├── json.ts            # Standard JSON backend
│   │   │   ├── jsonc.ts           # JSON with Comments
│   │   │   └── superjson.ts       # Type-preserving backend
│   │   ├── errors.ts              # Tagged error types
│   │   ├── schema.ts              # Schema validation utilities
│   │   ├── config.ts              # Service layer (DI)
│   │   ├── utils/                 # String utilities
│   │   └── __tests__/             # Test suites
│   ├── dist/                      # Built output (gitignored)
│   └── package.json
├── docs/                          # Planning documentation
└── .github/workflows/             # CI/CD pipelines
```

## Development Standards

### Runtime & Tools

**Default to using Bun instead of Node.js:**

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, don't use dotenv

### Effect Best Practices

1. **Use Effect.gen for composition:**
   ```typescript
   export const parse = <A, I>(schema: Schema.Schema<A, I>, input: string) =>
     Effect.gen(function* () {
       const raw = yield* backend.parse(input);
       const validated = yield* validateAgainstSchema(schema, raw);
       return validated;
     });
   ```

2. **Always use tagged errors:**
   ```typescript
   export class ParseError extends Data.TaggedError("ParseError")<{
     readonly message: string;
     readonly line: number;
     readonly column: number;
     readonly snippet: string;
   }> {}
   ```

3. **Leverage Effect.try for external APIs:**
   ```typescript
   Effect.try({
     try: () => JSON.parse(input),
     catch: (error) => new ParseError({ ... }),
   });
   ```

4. **Use pipe for transformations:**
   ```typescript
   Schema.decode(schema)(data).pipe(
     Effect.mapError((parseError) => new ValidationError({ ... })),
   );
   ```

### Code Style

- **TypeScript strict mode**: Enabled in tsconfig.json
- **Biome formatting**: Run `bun run check` before committing
- **No unused variables**: Prefix with `_` if intentionally unused
- **JSDoc comments**: Required for all public APIs
- **Immutability**: Prefer `readonly` and avoid mutations
- **Small functions**: Keep functions focused and testable

### Testing Requirements

- **Test location**: `src/__tests__/` directory
- **Test runner**: Vitest (via `bun test`)
- **Coverage target**: Minimum 85% (currently at 85.62%)
- **Test structure**:
  - `unit/backends/` - Backend-specific tests
  - `integration/` - Cross-backend, roundtrip, error recovery
  - `golden.test.ts` - Fixture-based tests

**Example test pattern:**
```typescript
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Json from "../index.js";

describe("Feature", () => {
  it("should handle success case", async () => {
    const schema = Schema.Struct({ id: Schema.Number });
    const result = await Effect.runPromise(
      Json.parse(schema, '{"id": 1}')
    );
    expect(result).toEqual({ id: 1 });
  });

  it("should handle error case", async () => {
    const result = await Effect.runPromise(
      Effect.either(Json.parse(schema, 'invalid'))
    );
    expect(result._tag).toBe("Left");
    expect(result.left._tag).toBe("ParseError");
  });
});
```

### Backend Implementation

When adding new backends, implement the `Backend` interface:

```typescript
export interface Backend {
  readonly parse: (input: string | Buffer) => Effect.Effect<unknown, ParseError>;
  readonly stringify: (value: unknown, options?: StringifyOptions) =>
    Effect.Effect<string, StringifyError>;
}
```

**Backend guidelines:**
- Delegate to existing backends when possible (see JSONC)
- Handle Buffer and string inputs via `toString` utility
- Provide detailed error messages with context
- Preserve line numbers for error reporting where applicable

### Error Handling Patterns

1. **Parse errors** - Include line, column, snippet:
   ```typescript
   const { line, column } = getLineColumn(input, position);
   const snippet = buildSnippet(input, position);
   return new ParseError({ message, line, column, snippet });
   ```

2. **Validation errors** - Include schema path and expected/actual:
   ```typescript
   return new ValidationError({
     message: `Schema validation failed: ${details}`,
     schemaPath: String(schema),
     expected: schema,
     actual: data,
   });
   ```

3. **Stringify errors** - Detect circular references:
   ```typescript
   const reason = errorMessage.includes("circular")
     ? "cycle"
     : "unknown";
   return new StringifyError({ message, reason });
   ```

## Development Workflow

### Local Development

```bash
# Install dependencies
bun install

# Run tests in watch mode
bun run test:watch

# Run linting
bun run check

# Type check
bun run typecheck

# Build
bun run build

# Run all quality checks
bun run check && bun run typecheck && bun run test && bun run build
```

### Before Committing

```bash
# Auto-fix formatting and linting
bun run check

# Ensure all tests pass
bun run test

# Verify TypeScript
bun run typecheck

# Verify build works
bun run build
```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

**Examples:**
```bash
feat: add YAML backend support
fix: correct line number calculation for Windows line endings
docs: update API documentation for parse function
test: add edge cases for circular reference detection
```

### Release Process

Releases are automated via GitHub Actions:

1. Update version in `packages/effect-json/package.json`
2. Update `CHANGELOG.md` with changes
3. Commit: `git commit -m "chore: bump version to 0.x.0"`
4. Tag: `git tag -a v0.x.0 -m "Release v0.x.0"`
5. Push: `git push && git push --tags`

GitHub Actions will:
- Run full CI suite (lint, typecheck, test, build)
- Publish to npm (requires NPM_TOKEN secret)
- Create GitHub Release with changelog

## Key Files & Their Purpose

- `src/index.ts` - Public API exports
- `src/api.ts` - Main API functions (parse, stringify, etc.)
- `src/backends/` - Backend implementations
- `src/errors.ts` - Error type definitions
- `src/schema.ts` - Schema validation utilities
- `src/config.ts` - Service layer for DI/testing
- `src/utils/string.ts` - String utilities (stripComments, getLineColumn, etc.)

## Common Tasks

### Adding a new backend

1. Create `src/backends/newbackend.ts`
2. Implement `Backend` interface
3. Export from `src/backends/index.ts`
4. Add parse/stringify functions to `src/api.ts`
5. Add tests in `src/__tests__/unit/backends/newbackend.test.ts`
6. Update documentation

### Fixing a bug

1. Add failing test that reproduces the bug
2. Fix the bug
3. Verify test passes
4. Run full test suite
5. Update CHANGELOG.md if user-facing

### Improving error messages

1. Locate error creation (usually in `backends/` or `schema.ts`)
2. Enhance error message with context
3. Update tests to verify new message format
4. Consider adding code snippets or suggestions

## Dependencies

### Production
- `effect` - Core Effect library (peer dependency)

### Optional
- `superjson` - For SuperJSON backend (optional peer dependency)

### Development
- `@biomejs/biome` - Linting and formatting
- `typescript` - Type checking
- `vitest` - Testing framework
- `vite` - Bundling
- `vite-plugin-dts` - TypeScript declaration generation

## CI/CD Pipelines

### CI Workflow (`.github/workflows/ci.yml`)
- Runs on: Every push to main, all PRs
- Jobs: Lint, TypeCheck, Test (multi-platform), Coverage, Build
- Platforms: Ubuntu, macOS, Windows
- Node versions: 20, 22

### Release Workflow (`.github/workflows/release.yml`)
- Runs on: Git tags matching `v*.*.*`
- Automated npm publishing with provenance
- Creates GitHub Release with changelog

### CodeQL Workflow (`.github/workflows/codeql.yml`)
- Runs: Weekly, on push/PR to main
- Security scanning for vulnerabilities

## Resources

- **Effect Documentation**: https://effect.website
- **Effect Schema**: https://effect.website/docs/schema/introduction
- **Bun Documentation**: https://bun.sh/docs
- **SuperJSON**: https://github.com/blitz-js/superjson

## Questions?

- Check `CONTRIBUTING.md` for contribution guidelines
- Review existing tests for patterns
- See `packages/effect-json/ARCHITECTURE.md` for design decisions
- Open a GitHub Discussion for questions

---

**Remember**: This is a production library used by real users. Maintain high quality standards, comprehensive tests, and clear documentation for all changes.
