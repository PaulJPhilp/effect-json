# Security Policy

## Supported Versions

We actively support the following versions of effect-json with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of effect-json seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do Not** Create a Public Issue

Please do not create a public GitHub issue for security vulnerabilities. This helps protect users who haven't updated yet.

### 2. Report Privately

Report security vulnerabilities privately through one of these methods:

- **GitHub Security Advisory**: Use the [Security Advisory](https://github.com/PaulJPhilp/effect-json/security/advisories/new) feature (preferred)
- **Email**: Send details to the maintainer (details in package.json)

### 3. Provide Details

Include the following information:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)
- Your name/handle for credit (optional)

### 4. Response Timeline

We aim to:

- Acknowledge receipt within **48 hours**
- Provide an initial assessment within **7 days**
- Release a fix within **30 days** for high-severity issues

### 5. Coordinated Disclosure

We follow coordinated disclosure:

1. We'll work with you to understand and verify the issue
2. We'll develop and test a fix
3. We'll prepare a security advisory
4. We'll release the fix and publish the advisory
5. We'll credit you (if desired) in the advisory

## Security Best Practices

When using effect-json:

### Input Validation

Always use Effect.Schema validation on untrusted input:

```typescript
import { Schema, Effect } from "effect";
import * as Json from "effect-json";

const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
});

// Good - validates untrusted input
const parseUserInput = (input: string) =>
  Json.parse(UserSchema, input);

// Handle errors appropriately
const result = await Effect.runPromise(
  Effect.either(parseUserInput(untrustedInput))
);
```

### Avoid Large Payloads

Limit the size of JSON payloads to prevent DoS attacks:

```typescript
const MAX_SIZE = 1024 * 1024; // 1MB

if (input.length > MAX_SIZE) {
  throw new Error("Input too large");
}
```

### Circular Reference Protection

effect-json detects circular references and throws `StringifyError`:

```typescript
const obj: any = { id: 1 };
obj.self = obj;

const result = await Effect.runPromise(
  Effect.either(Json.stringify(Schema.Unknown, obj))
);
// result._tag === "Left" with StringifyError (reason: "cycle")
```

### SuperJSON Security

When using SuperJSON with untrusted input, be aware:

- SuperJSON can deserialize Date, Map, Set, BigInt, etc.
- Only use SuperJSON with trusted sources
- For untrusted input, prefer standard JSON backend

```typescript
// For untrusted input - use JSON backend
const untrustedData = Json.parse(schema, untrustedInput);

// For trusted, internal data - can use SuperJSON
const trustedData = Json.parseSuperjson(schema, internalData);
```

### Type Safety

Always define strict schemas:

```typescript
// Good - strict schema
const UserSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
});

// Avoid - too permissive
const LooseSchema = Schema.Unknown;
```

## Dependencies

effect-json has minimal dependencies:

- **effect**: Peer dependency - maintained by Effect-TS team
- **superjson**: Optional peer dependency - only needed for SuperJSON backend

We regularly update dependencies and monitor for security advisories via:

- Dependabot alerts
- GitHub Security Advisories
- npm audit

## Security Updates

Security updates will be released as:

- **Patch versions** (0.1.x) for backwards-compatible fixes
- **Security advisories** on GitHub
- **Changelog entries** marked with `[SECURITY]`

Subscribe to releases to be notified of security updates.

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report vulnerabilities (with their permission) in:

- The security advisory
- The CHANGELOG
- The project README

Thank you for helping keep effect-json and its users safe!
