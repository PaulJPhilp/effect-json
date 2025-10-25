# effect-json – Market Requirements Document

## Executive Summary

**effect-json** is a type-safe, schema-driven JSON serialization library for TypeScript and Effect ecosystems. It solves the fundamental problem of safe, composable JSON handling by providing multiple serialization backends (JSON, JSONC, SuperJSON) with unified, Effect-based APIs.

### The Problem

Developers repeatedly write boilerplate for safe JSON parsing/stringifying:
- `safeParseJson` helpers across projects
- Manual error handling for parse failures
- No support for JSON with comments (JSONC) in configuration files
- Type information loss during serialization (Date → string, Set → array)
- Inconsistent error recovery strategies

This pattern appears across:
- **effect-env** (configuration parsing)
- **effect-xstate** (actor state persistence)
- **Writing Buddy** (storing actor snapshots)
- **General TypeScript projects** (API responses, file I/O, storage)

### The Solution

A unified, extensible JSON library built on Effect principles:
- **Schema-driven**: Use Effect.Schema as the single source of truth for types
- **Multiple backends**: JSON (strict), JSONC (with comments), SuperJSON (type-aware)
- **Effect-native**: All operations return Effects; compose with pipes and flatMap
- **Error precision**: Tagged errors with rich context (line/column for parse errors)
- **Testable**: Pluggable backends enable in-memory, mock, and deterministic testing
- **Agent-friendly**: Clear contracts and patterns that AI coding agents can understand and extend

---

## Target Users & Personas

### Persona 1: Paul (Effect-First Developer)
- **Profile**: Shipping Effect-based systems (effect-xstate, effect-env, Writing Buddy)
- **Pain point**: Repeatedly implementing safe JSON parsing; wants to avoid boilerplate
- **Need**: A library that fits naturally into Effect pipelines; composable, testable, auditable
- **Success metric**: Can replace all `safeParseJson` calls with `Json.parse(schema)`; no cognitive overhead

### Persona 2: TypeScript Team (General Purpose)
- **Profile**: Building TypeScript applications; familiar with schemas but not necessarily Effect
- **Pain point**: Standard JSON parsing doesn't preserve types (Date, Set, BigInt); comments in JSON configs are useful
- **Need**: A JSON library that "just works" without forcing Effect adoption; optional advanced features
- **Success metric**: Can use effect-json as a drop-in replacement for JSON.parse/stringify with better DX

### Persona 3: AI Coding Agents (Claude, etc.)
- **Profile**: Reading specs, implementing code, writing tests
- **Pain point**: Ambiguous JSON handling patterns; unclear error contracts
- **Need**: Clear, declarative specs for JSON operations; consistent patterns across the library
- **Success metric**: Can read ARCHITECTURE.md and implement new backends without asking for clarification

### Persona 4: Config/Infrastructure Developer
- **Profile**: Managing application configuration, actor state files, golden test fixtures
- **Pain point**: JSON doesn't support comments; comments are critical for documentation in config files
- **Need**: JSONC support (comments + human readability) alongside strict JSON for portability
- **Success metric**: Config files are readable, maintainable, and can be version-controlled with clarity

---

## Market Scope & Positioning

### Primary Use Cases
1. **Safe JSON parsing in Effect applications** (effect-env, effect-xstate, custom services)
2. **Configuration file handling** (JSONC with comments for readability)
3. **Type-preserving serialization** (SuperJSON for Date, Set, Map, BigInt, etc.)
4. **Golden test fixtures** (JSONC for annotated, readable test data)
5. **General TypeScript JSON operations** (API responses, file I/O, storage layers)

### Market Position
- **Not a replacement for**: JSON.stringify/parse (we use them under the hood)
- **Not a replacement for**: YAML, TOML, or Protocol Buffers (different use cases)
- **Complements**: Effect.Schema, Zod, io-ts (schema validation libraries)
- **Integrates with**: Effect ecosystem, Turborepo, Vite, Bun

### Competitive Advantages
1. **Effect-native**: First-class Effect integration; composable with pipes, flatMap, etc.
2. **Multiple backends**: JSON + JSONC + SuperJSON in one coherent API
3. **Schema-driven**: Leverages Effect.Schema for type safety and validation
4. **Agent-ready**: Clear patterns, testable, easy for AI to reason about and extend
5. **Community value**: Reusable across multiple projects (effect-env, effect-xstate, etc.)

---

## Success Criteria

### Functional
- [ ] Parse JSON, JSONC, and SuperJSON with schema validation
- [ ] Stringify with schema-aware type preservation
- [ ] Provide precise error information (parse failures with line/column)
- [ ] Support pluggable backends (add new formats without modifying core)

### Non-Functional
- [ ] All operations are Effect-based (no sync APIs that hide side effects)
- [ ] Full TypeScript strict mode compliance
- [ ] Zero external dependencies (except Effect)
- [ ] ≥90% test coverage (unit + integration)
- [ ] Agent-parseable documentation (clear, machine-readable specs)

### Experience
- [ ] DX: Agents can implement new backends from ARCHITECTURE.md alone
- [ ] DX: Developers can swap backends with single-line config changes
- [ ] DX: Error messages are actionable and include remediation hints

---

## Out of Scope (v1.0)

- Streaming JSON parsing (use Node.js streams or Effect Stream)
- XML, YAML, TOML support (separate libraries)
- Binary serialization (use MessagePack, Protocol Buffers)
- JSON Schema generation from TypeScript types (use separate tools)
- GraphQL, REST API-specific features (use Apollo, tRPC, etc.)

---

## Timeline & Phasing

- **Phase 1**: Core library + JSON backend + JSONC backend
- **Phase 2**: SuperJSON backend + comprehensive error handling
- **Phase 3**: Polish, docs, ecosystem integration (effect-env, effect-xstate use it)
- **Phase 4** (Future): Additional backends (PKL, MessagePack) + streaming

---

## Success Metrics (Post-Launch)

- effect-env, effect-xstate, Writing Buddy adopt effect-json for all JSON operations
- Zero `safeParseJson` boilerplate across the ecosystem
- Agents can implement new backends from spec alone (no clarifying questions)
- Community contributions: new backends, integrations, or patterns