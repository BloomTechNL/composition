# Composition

A small composition root for TypeScript.

`@bloom-group/composition` wires dependencies with plain factory functions instead of decorators or reflection. It gives you:

- **`Scope`**: the base class behind every scope. A scope builds a dependency once and caches it.
- **`AppScope`**: the scope for dependencies that live as long as the process, such as database pools and configuration.
- **`Registry`** and **`Resolver`**: let code outside the composition root, such as route handlers, get a dependency by its class without knowing how it is built.

The package ships no request or tenant scope on purpose: what "per request" means differs per application, so you define your own in a few lines (see [Adding your own scopes](#adding-your-own-scopes)).

## Installation

```bash
npm install @bloom-group/composition
```

The package is ESM-only.

## Scopes

Every scope has `resolve(factory, key?)`. The first call runs the factory and caches the result; later calls with the same factory return the cached instance. Pass a `key` to keep several instances from one factory.

```ts
import { AppScope } from '@bloom-group/composition';

const pool = AppScope.instance.resolve(() => new Pool(config));
const replica = AppScope.instance.resolve(
  () => new Pool(replicaConfig),
  'replica',
);
```

The cache key is the factory's source text, so write each factory inline in one place, typically one function per dependency.

### AppScope

`AppScope.instance` is the process-wide scope. Create `new AppScope()` in tests to get a fresh cache.

## Adding your own scopes

A scope is a cache with a lifetime. Dependencies that should live as long as the process go in `AppScope`. Dependencies that should live shorter, such as for one HTTP request, one job or one test, go in a scope you create for that lifetime and throw away afterwards. Everything resolved on it is cached until the scope is dropped, so a dependency is shared within one request but never leaks into the next.

Extend `Scope`, and add whatever that lifetime needs to know:

```ts
import { AppScope, Scope } from '@bloom-group/composition';

export class RequestScope extends Scope {
  constructor(
    public readonly appScope: AppScope,
    public readonly tenantId: number,
  ) {
    super();
  }
}

// In your request handler:
const scope = new RequestScope(AppScope.instance, 42);
```

Two conventions make this work:

- **A short-lived scope holds a reference to the longer-lived one** (`appScope`), so its factories can reach singletons. Never the other way around: an `AppScope` dependency must not depend on a request-scoped one, because it would outlive it.
- **Per-request data lives on the scope** (`tenantId`, a user, a locale, a trace id), so factories read it from there instead of taking it as a parameter everywhere.

Add as many scopes as you have lifetimes, for example a `StartupTaskScope` for migrations or a `JobScope` for queue workers. Because factories only need the capabilities they use, you can type them against a smaller interface and let every scope class that has those fields satisfy it:

```ts
interface TenantScope extends Scope {
  readonly appScope: AppScope;
  readonly tenantId: number;
}
```

## Factory functions

Write one factory function per dependency. Resolve request-scoped dependencies on the scope, and singletons on `scope.appScope`:

```ts
import type { AppScope } from '@bloom-group/composition';

export function postgresPool(scope: AppScope): Pool {
  return scope.resolve(() => new Pool(config));
}

export function flowerRepository(scope: RequestScope): FlowerRepository {
  return scope.resolve(
    () => new FlowerRepository(postgresPool(scope.appScope), scope.tenantId),
  );
}
```

## Resolver

Factory functions and scopes belong to the composition root, the one place that knows how your application is wired. Code outside it, such as an Express, tRPC or Hono route handler, should not need to know which scope a dependency lives in or which factory builds it. It only needs to say what it wants.

That is what the `Resolver` is for. The composition root builds one for each request and puts it on the framework's context object. Handlers then ask it for a dependency by its class, and get back a fully wired instance:

```ts
// Composition root: one resolver per request, put on the context.
function createContext(request: Request): { resolver: Resolver<RequestScope> } {
  const scope = new RequestScope(AppScope.instance, tenantIdFrom(request));
  return { resolver: new Resolver(scope, registry) };
}

// Route handler, outside the composition root:
const createFlower = await context.resolver.resolve(CreateFlower);
```

The handler depends only on the `Resolver` and the class it asks for. Scopes, factory functions and how dependencies are built stay inside the composition root and can change without touching any handler.

A `Registry` maps classes to providers for one scope type, and a `Resolver` builds those classes on a scope of that type. Pass the registrations to the `Registry` constructor as `[Class, provider]` pairs, then pass the scope and the registry to the `Resolver` constructor. The registry's scope type must match the scope, so providers receive your own scope type without narrowing it first.

```ts
import { AppScope, Registry, Resolver } from '@bloom-group/composition';

export const registry = new Registry<RequestScope>([
  [CreateFlower, (scope) => new CreateFlower(flowerRepository(scope))],
  [GetFlowers, (scope) => new GetFlowers(flowerRepository(scope))],
]);

const resolver = new Resolver(
  new RequestScope(AppScope.instance, 42),
  registry,
);
const handler = await resolver.resolve(CreateFlower);
```

The resolver does not cache anything itself. Caching comes from the scope: in the example, `flowerRepository` resolves on the scope, so every handler built on one scope shares one repository, while each `resolve` builds a new handler. To share the class itself within a scope, resolve it on the scope in the provider:

```ts
export const registry = new Registry<RequestScope>([
  [
    CreateFlower,
    (scope) => scope.resolve(() => new CreateFlower(flowerRepository(scope))),
  ],
]);
```

A provider may be async, and `resolve` waits for it. Wrap an async provider in `scope.resolve` to run it once per scope: the scope then caches the promise, so concurrent `resolve` calls share one build. A rejected promise stays cached in that scope.

TypeScript checks that each provider accepts the registry's scope type, but not that it returns an instance of the class it is paired with, so keep each pair consistent.

`resolve` rejects with `No provider found for <ClassName>` when a class has no registration. The `Registry` constructor throws `<ClassName> is already registered` when a class appears twice.

## Rules

- Use `scope.resolve()` for request-scoped dependencies and `scope.appScope.resolve()` for singletons.
- App-scoped dependencies must not depend on request-scoped ones.
- Register each class once per registry, with a provider that returns an instance of that class.
- Keep factories free of side effects other than building the instance.

## Testing

Call factory functions directly with a fresh scope:

```ts
const scope = new RequestScope(new AppScope(), 1);
const repository = flowerRepository(scope);
```

## Contributing and releases

Use `npm run deps:install` to install (it audits the frozen lockfile first and installs without lifecycle scripts), and run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before pushing to `main`. Releases are published from GitHub Actions with provenance: bump `version` in `package.json`, push to `main`, then run **CI and npm release** with that version. See [AGENTS.md](AGENTS.md) for the full process and settings.

## License

MIT
