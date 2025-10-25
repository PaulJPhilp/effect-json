# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-10-25

### Added
- Initial release of effect-json
- Type-safe JSON parsing with Effect.Schema validation
- Support for three serialization backends:
  - **JSON**: Standard JSON.parse/stringify with precise error reporting
  - **JSONC**: JSON with Comments support (strips single-line and multi-line comments)
  - **SuperJSON**: Type-preserving serialization for Date, Set, Map, BigInt, etc.
- Comprehensive error handling with tagged errors:
  - `ParseError`: JSON parsing failures with line/column information
  - `ValidationError`: Schema validation failures with detailed messages
  - `StringifyError`: Stringification failures (circular references, type errors)
- Effect-native API:
  - `parse()`, `parseJsonc()`, `parseSuperjson()` for parsing
  - `stringify()`, `stringifyJsonc()`, `stringifySuperjson()` for serialization
  - Full Effect composability with `Effect.gen`, `catchTag`, `orElse`, etc.
- Pluggable backend system for extensibility
- Dependency injection support via `JsonService` for testing
- 84 comprehensive tests with 85%+ code coverage
- Full TypeScript strict mode support
- CommonJS and ESM module support

### Documentation
- Comprehensive README with examples
- API documentation with JSDoc comments
- Architecture documentation in `packages/effect-json/ARCHITECTURE.md`
- Planning documentation in `docs/` directory (MRD, PRD, Architecture, Implementation Plan)

### Infrastructure
- Bun-based build system
- Turborepo monorepo setup
- Vitest for testing with coverage reporting
- Biome for linting and formatting
- Vite for bundling with TypeScript declaration generation

[Unreleased]: https://github.com/PaulJPhilp/effect-json/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/PaulJPhilp/effect-json/releases/tag/v0.1.0
