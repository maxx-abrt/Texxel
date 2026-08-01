# `@a2e/core` — vendored shared package

This directory is a **verbatim copy of `packages/core` from the A2E-Core repo**
(<https://github.com/maxx-abrt/A2E-Core>), consumed by `apps/web` and
`apps/mobile` as a pnpm workspace dependency (`"@a2e/core": "workspace:*"`).

| | |
|---|---|
| Upstream repo | `maxx-abrt/A2E-Core` |
| Upstream path | `packages/core` |
| Vendored version | **0.2.0** |
| Upstream commit | `b0c6ecc7ef7ffd7d1ee327595d962701340e6e68` |

## Why vendored instead of `link:` / `github:`

The previous specifier was `"@a2e/core": "link:../../../A2E Core/packages/core"`
— a path **outside the repository**. It works on the machine that has the
sibling checkout, but on Vercel/EAS the link target does not exist: `pnpm i`
silently succeeds (link deps are never verified) and the bundler then fails with
19 × `Module not found: Can't resolve '@a2e/core'`.

A `github:maxx-abrt/A2E-Core#v0.2.0` specifier would require Vercel/EAS to clone
a **private** repo (PAT committed in the URL, or a git submodule the build
runner can read). Vendoring keeps builds hermetic, deterministic and
credential-free, and it is exactly what the guide's release model produces
anyway: the package ships raw TypeScript and is *bundled into each app at build
time* (integration guide §7).

## Rules (unchanged from the guide)

- **Do not hand-edit files in `src/`.** Any change to the shared contract is a PR
  on **A2E-Core** (guide §6, additive-only law), released as a new version, then
  pulled in here.
- Core **Convex functions are never copied** — only this client package is. All
  server-side access stays remote (`CoreProvider` → core deployment) or through
  the secret-gated service bridge (`sync:*`, guide §12.1).

## Re-syncing after a core release

```bash
# a) from a local checkout of A2E-Core
A2E_CORE_PATH="../A2E Core" pnpm sync:core

# b) straight from GitHub (needs read access to the private repo)
GITHUB_TOKEN=ghp_xxx pnpm sync:core --ref v0.3.0
```

The script overwrites `src/`, `CHANGELOG.md` and the `a2e.upstream*` fields in
`package.json`, then prints a diff summary. Review the CHANGELOG, run
`pnpm typecheck`, commit.
