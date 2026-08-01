/**
 * Forward-compatible access to A2E Core functions.
 *
 * `@a2e/core` exposes typed refs for everything it knows about (`coreApi.*`).
 * When the shared backend gains a NEW module/function, apps do not have to wait
 * for a package release: core functions are addressed **by name**
 * (`"module:function"`), so `coreRef` lets this app call them today and swap to
 * the typed `coreApi.*` ref whenever the vendored package is re-synced.
 *
 * ```ts
 * const rows = useCoreQuery(coreRef.query<{ workspaceId: string }, Row[]>("crm_deals:list"), { workspaceId });
 * ```
 *
 * Rules that still apply (integration guide §3): the shared schema/functions are
 * only ever authored in the A2E-Core repo — never re-implemented here — and every
 * call is workspace-scoped.
 */
import { makeFunctionReference } from "convex/server";

// Convex's arg constraint needs an index signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;

export const coreRef = {
  query: <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"query", A, R>(name),
  mutation: <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"mutation", A, R>(name),
  action: <A extends Args = Args, R = unknown>(name: string) => makeFunctionReference<"action", A, R>(name),
};

export { coreApi } from "@a2e/core";
