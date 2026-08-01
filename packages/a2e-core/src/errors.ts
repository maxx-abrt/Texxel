/** Translates core error strings into typed errors. Used by every hook. */

export class QuotaExceededError extends Error {
  constructor(
    readonly domain: string,
    readonly limit: number,
    readonly used: number,
  ) {
    super(`QuotaExceeded:${domain}:${used}/${limit}`)
    this.name = "QuotaExceededError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Not authenticated") {
    super(message)
    this.name = "UnauthenticatedError"
  }
}

const QUOTA_RE = /QuotaExceeded:([a-zA-Z]+):(-?\d+)\/(-?\d+)/

/** Maps a raw Convex error onto a typed core error (never throws itself). */
export function toCoreError(error: unknown): Error {
  const raw = error instanceof Error ? error : new Error(String(error))
  const message = raw.message

  const quota = QUOTA_RE.exec(message)
  if (quota) return new QuotaExceededError(quota[1], Number(quota[3]), Number(quota[2]))
  if (message.includes("Forbidden")) return new ForbiddenError(message)
  if (message.includes("Not authenticated") || message.includes("not provisioned")) {
    return new UnauthenticatedError(message)
  }
  if (/not found|Invalid or expired|Folder not empty/i.test(message)) return new NotFoundError(message)
  return raw
}

/** Wraps an async call so consumers only ever see typed core errors. */
export async function withCoreErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    throw toCoreError(error)
  }
}
