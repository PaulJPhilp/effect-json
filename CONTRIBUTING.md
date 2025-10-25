# Contributing to effect-json

Thank you for your interest in contributing to effect-json! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the behavior
- Expected vs actual behavior
- Minimal code sample demonstrating the issue
- Your environment (OS, Node/Bun version, effect-json version)

Use the bug report template when creating a new issue.

### Suggesting Features

Feature suggestions are welcome! Please:

- Use the feature request template
- Explain the problem you're trying to solve
- Describe your proposed solution
- Consider the impact on existing APIs
- Think about backwards compatibility

### Pull Requests

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/effect-json.git
   cd effect-json
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

4. **Make Your Changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

5. **Run Quality Checks**
   ```bash
   # Run all checks
   bun run check      # Linting
   bun run typecheck  # Type checking
   bun run test       # Tests
   bun run build      # Build
   ```

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `test:` test changes
   - `refactor:` code refactoring
   - `perf:` performance improvements
   - `chore:` maintenance tasks

7. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a pull request on GitHub using the PR template.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) 1.0.0 or later
- Git

### Project Structure

```
effect-json/
├── packages/
│   └── effect-json/          # Main package
│       ├── src/
│       │   ├── api.ts         # Public API
│       │   ├── backends/      # JSON, JSONC, SuperJSON backends
│       │   ├── errors.ts      # Error types
│       │   ├── schema.ts      # Schema validation
│       │   └── __tests__/     # Tests
│       ├── dist/              # Built output
│       └── package.json
├── docs/                      # Documentation
└── README.md
```

### Development Commands

```bash
# Install dependencies
bun install

# Run tests
bun test                    # Run all tests
bun run test:watch          # Watch mode
bun run test:coverage       # With coverage

# Linting and formatting
bun run check              # Check and auto-fix
bun run lint               # Lint only

# Type checking
bun run typecheck

# Build
bun run build

# Clean
bun run clean
```

### Writing Tests

- Place tests in `src/__tests__/`
- Use descriptive test names
- Test both success and failure cases
- Aim for >85% code coverage
- Use Effect's testing utilities

Example test:

```typescript
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as Json from "../index.js";

describe("MyFeature", () => {
  it("should do something", async () => {
    const schema = Schema.Struct({ id: Schema.Number });
    const result = await Effect.runPromise(
      Json.parse(schema, '{"id": 1}')
    );
    expect(result).toEqual({ id: 1 });
  });
});
```

### Code Style

- Use TypeScript strict mode
- Follow Effect best practices
- Use Effect.gen for composing effects
- Use tagged errors for error handling
- Write JSDoc comments for public APIs
- Keep functions small and focused
- Prefer immutability

### Documentation

When adding new features:

1. Update JSDoc comments in source code
2. Add examples to README if applicable
3. Update CHANGELOG.md
4. Consider adding to ARCHITECTURE.md for significant changes

## Release Process

Releases are automated through GitHub Actions:

1. Update version in `packages/effect-json/package.json`
2. Update `CHANGELOG.md` with changes
3. Commit changes
4. Create and push a tag:
   ```bash
   git tag -a v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```
5. GitHub Actions will automatically:
   - Run all tests
   - Build the package
   - Publish to npm
   - Create a GitHub release

## Getting Help

- **Questions**: Use [GitHub Discussions](https://github.com/PaulJPhilp/effect-json/discussions)
- **Bugs**: Create an issue with the bug report template
- **Features**: Create an issue with the feature request template
- **Effect Support**: Join the [Effect Discord](https://discord.gg/effect-ts)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:
- The CHANGELOG for their specific contributions
- The README contributors section
- GitHub's contributors graph

Thank you for contributing to effect-json! 🎉
