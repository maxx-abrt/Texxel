"use client"

import { ConvexReactClient } from "convex/react"
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server"
import * as React from "react"
import { CORE_URL_ENV_KEYS, readEnv } from "./env"
import { toCoreError, withCoreErrors } from "./errors"
import type { CoreRoutes } from "./types"

/** Returns the app's current access token (WorkOS AuthKit token in the A2E suite). */
export type CoreTokenFetcher = (args: { forceRefreshToken: boolean }) => Promise<string | null | undefined>

interface CoreContextValue {
  client: ConvexReactClient
  routes: CoreRoutes
  isAuthenticated: boolean
  isAuthLoading: boolean
}

const CoreContext = React.createContext<CoreContextValue | null>(null)
const CoreAuthContext = React.createContext<CoreTokenFetcher | null>(null)

/**
 * Alternative to the `fetchToken` prop: wrap the tree with the app's token getter.
 * Useful when the token fetcher lives above the provider (e.g. Bilan's AuthKit hook).
 */
export function CoreAuthProvider(props: { fetchToken: CoreTokenFetcher; children: React.ReactNode }) {
  return <CoreAuthContext.Provider value={props.fetchToken}>{props.children}</CoreAuthContext.Provider>
}

export interface CoreProviderProps {
  children: React.ReactNode
  /** Core deployment URL. Defaults to `NEXT_PUBLIC_CONVEX_CORE_URL` / `EXPO_PUBLIC_CONVEX_CORE_URL`. */
  url?: string
  /** Reuse an existing client (tests, SSR harnesses, multiple providers). */
  client?: ConvexReactClient
  /** Access-token getter. Falls back to the nearest `<CoreAuthProvider>`. */
  fetchToken?: CoreTokenFetcher
  /** Maps core entities to app-local URLs (used by search/notification hrefs). */
  routes?: CoreRoutes
}

function resolveUrl(explicit?: string): string {
  const url = explicit ?? readEnv(...CORE_URL_ENV_KEYS)
  if (!url) {
    throw new Error(
      "[@a2e/core] Missing core deployment URL. Pass <CoreProvider url> or set NEXT_PUBLIC_CONVEX_CORE_URL.",
    )
  }
  return url
}

/**
 * Mounts a dedicated Convex client for the **core** deployment. Deliberately does NOT
 * use `ConvexProvider`, so an app's own Convex client keeps working untouched.
 */
export function CoreProvider({ children, url, client, fetchToken, routes }: CoreProviderProps) {
  const contextFetchToken = React.useContext(CoreAuthContext)
  const tokenFetcher = fetchToken ?? contextFetchToken ?? null

  const [ownClient] = React.useState<ConvexReactClient | null>(() => (client ? null : new ConvexReactClient(resolveUrl(url))))
  const activeClient = client ?? (ownClient as ConvexReactClient)

  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [isAuthLoading, setIsAuthLoading] = React.useState(Boolean(tokenFetcher))

  React.useEffect(() => {
    return () => {
      // Only dispose clients we created ourselves.
      void ownClient?.close()
    }
  }, [ownClient])

  React.useEffect(() => {
    if (!tokenFetcher) {
      activeClient.clearAuth()
      setIsAuthenticated(false)
      setIsAuthLoading(false)
      return
    }
    setIsAuthLoading(true)
    activeClient.setAuth(tokenFetcher, (authenticated) => {
      setIsAuthenticated(authenticated)
      setIsAuthLoading(false)
    })
  }, [activeClient, tokenFetcher])

  const value = React.useMemo<CoreContextValue>(
    () => ({ client: activeClient, routes: routes ?? {}, isAuthenticated, isAuthLoading }),
    [activeClient, routes, isAuthenticated, isAuthLoading],
  )

  return <CoreContext.Provider value={value}>{children}</CoreContext.Provider>
}

function useCoreContext(): CoreContextValue {
  const ctx = React.useContext(CoreContext)
  if (!ctx) throw new Error("[@a2e/core] Missing <CoreProvider>. Wrap your app with it.")
  return ctx
}

/** Escape hatch: the raw Convex client bound to the core deployment. */
export function useCoreClient(): ConvexReactClient {
  return useCoreContext().client
}

export function useCoreAuthState(): { isAuthenticated: boolean; isLoading: boolean } {
  const { isAuthenticated, isAuthLoading } = useCoreContext()
  return { isAuthenticated, isLoading: isAuthLoading }
}

export function useCoreRoutes(): CoreRoutes {
  return useCoreContext().routes
}

/**
 * Reactive query bound to the core client. Pass `"skip"` to disable — every hook in
 * this package does that when the workspace is not resolved yet.
 */
export function useCoreQuery<Q extends FunctionReference<"query">>(
  ref: Q,
  args: FunctionArgs<Q> | "skip",
): FunctionReturnType<Q> | undefined {
  const client = useCoreClient()
  const skip = args === "skip"
  // Structural key keeps the subscription stable across re-renders with equal args.
  const argsKey = skip ? "skip" : JSON.stringify(args)
  const [state, setState] = React.useState<{ key: string; data?: FunctionReturnType<Q>; error?: Error }>({
    key: argsKey,
  })

  React.useEffect(() => {
    if (skip) {
      setState({ key: "skip" })
      return
    }
    const watch = client.watchQuery(ref, args as FunctionArgs<Q>)
    const read = () => {
      try {
        setState({ key: argsKey, data: watch.localQueryResult() as FunctionReturnType<Q> })
      } catch (error) {
        setState({ key: argsKey, error: toCoreError(error) })
      }
    }
    read()
    return watch.onUpdate(read)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, ref, argsKey, skip])

  if (state.error) throw state.error
  return state.key === argsKey ? state.data : undefined
}

/** Mutation bound to the core client; rejects with typed core errors. */
export function useCoreMutation<M extends FunctionReference<"mutation">>(
  ref: M,
): (args: FunctionArgs<M>) => Promise<FunctionReturnType<M>> {
  const client = useCoreClient()
  return React.useCallback((args: FunctionArgs<M>) => withCoreErrors(() => client.mutation(ref, args)), [client, ref])
}

/** Action bound to the core client; rejects with typed core errors. */
export function useCoreAction<A extends FunctionReference<"action">>(
  ref: A,
): (args: FunctionArgs<A>) => Promise<FunctionReturnType<A>> {
  const client = useCoreClient()
  return React.useCallback((args: FunctionArgs<A>) => withCoreErrors(() => client.action(ref, args)), [client, ref])
}
