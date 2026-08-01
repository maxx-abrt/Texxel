"use client"

import * as React from "react"
import { useCoreAction, useCoreMutation, useCoreQuery } from "./client"
import { toCoreError } from "./errors"
import { coreApi } from "./refs"
import type { DriveFileDoc, DriveFolderDoc, EntityRef, Id } from "./types"

export interface UploadArgs {
  workspaceId: Id<"workspaces">
  /** `File` in the browser; on React Native pass `await (await fetch(uri)).blob()`. */
  file: File | Blob
  name?: string
  contentType?: string
  folderId?: Id<"drive_folders">
  sourceApp: string
  linkedTo?: EntityRef
}

function putWithProgress(url: string, body: Blob, contentType: string, onProgress?: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url, true)
    xhr.setRequestHeader("Content-Type", contentType)
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${xhr.status}`))
    xhr.onerror = () => reject(new Error("Upload failed: network error"))
    xhr.send(body)
  })
}

/** Presign → PUT to B2 (with progress) → resolved core file id. */
export function useUpload(opts?: { onProgress?: (pct: number) => void }) {
  const presign = useCoreAction(coreApi.drive.presignUpload)
  const [isUploading, setIsUploading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const upload = React.useCallback(
    async (args: UploadArgs): Promise<{ fileId: Id<"drive_files"> }> => {
      const name = args.name ?? (args.file as File).name ?? "file"
      const contentType = args.contentType ?? args.file.type ?? "application/octet-stream"
      setIsUploading(true)
      setError(null)
      try {
        const { fileId, uploadUrl } = await presign({
          workspaceId: args.workspaceId,
          name,
          size: args.file.size,
          contentType,
          folderId: args.folderId,
          sourceApp: args.sourceApp,
          linkedTo: args.linkedTo,
        })
        opts?.onProgress?.(0)
        await putWithProgress(uploadUrl, args.file, contentType, opts?.onProgress)
        opts?.onProgress?.(100)
        return { fileId }
      } catch (raw) {
        const err = toCoreError(raw)
        setError(err)
        throw err
      } finally {
        setIsUploading(false)
      }
    },
    [presign, opts],
  )

  return { upload, isUploading, error }
}

export function useFiles(
  workspaceId?: Id<"workspaces"> | null,
  folderId?: Id<"drive_folders">,
): DriveFileDoc[] | undefined {
  return useCoreQuery(coreApi.drive.listFiles, workspaceId ? { workspaceId, folderId } : "skip")
}

export function useFolders(
  workspaceId?: Id<"workspaces"> | null,
  parentId?: Id<"drive_folders">,
): DriveFolderDoc[] | undefined {
  return useCoreQuery(coreApi.drive.listFolders, workspaceId ? { workspaceId, parentId } : "skip")
}

export function useTrash(workspaceId?: Id<"workspaces"> | null): DriveFileDoc[] | undefined {
  return useCoreQuery(coreApi.drive.listTrash, workspaceId ? { workspaceId } : "skip")
}

export function useLinkedFiles(
  workspaceId: Id<"workspaces"> | null | undefined,
  target: EntityRef | null | undefined,
): DriveFileDoc[] | undefined {
  return useCoreQuery(
    coreApi.drive.listLinked,
    workspaceId && target ? { workspaceId, app: target.app, type: target.type, id: target.id } : "skip",
  )
}

export function useFileSearch(
  workspaceId: Id<"workspaces"> | null | undefined,
  query: string,
): DriveFileDoc[] | undefined {
  const term = query.trim()
  return useCoreQuery(coreApi.drive.searchFiles, workspaceId && term.length >= 2 ? { workspaceId, query: term } : "skip")
}

// Presigned URLs live 10 min server-side; cache slightly shorter to stay safe.
const URL_TTL_MS = 8 * 60 * 1000
const urlCache = new Map<string, { url: string; expiresAt: number }>()

/** Resolves a short-lived presigned URL, cached per file+mode for 8 minutes. */
export function useFileUrl(
  fileId: Id<"drive_files"> | null | undefined,
  mode: "view" | "download" = "view",
): string | null | undefined {
  const presignView = useCoreAction(coreApi.drive.presignView)
  const presignDownload = useCoreAction(coreApi.drive.presignDownload)
  const [url, setUrl] = React.useState<string | null | undefined>(undefined)

  React.useEffect(() => {
    if (!fileId) {
      setUrl(null)
      return
    }
    const key = `${mode}:${fileId}`
    const cached = urlCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url)
      return
    }
    let cancelled = false
    setUrl(undefined)
    const run = mode === "view" ? presignView : presignDownload
    run({ fileId })
      .then(({ url: signed }) => {
        urlCache.set(key, { url: signed, expiresAt: Date.now() + URL_TTL_MS })
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [fileId, mode, presignView, presignDownload])

  return url
}

export function useDriveMutations() {
  const createFolder = useCoreMutation(coreApi.drive.createFolder)
  const renameFolder = useCoreMutation(coreApi.drive.renameFolder)
  const deleteFolder = useCoreMutation(coreApi.drive.deleteFolder)
  const renameFile = useCoreMutation(coreApi.drive.renameFile)
  const moveFile = useCoreMutation(coreApi.drive.moveFile)
  const removeFile = useCoreMutation(coreApi.drive.removeFile)
  const restoreFile = useCoreMutation(coreApi.drive.restoreFile)
  const emptyTrash = useCoreMutation(coreApi.drive.emptyTrash)
  return React.useMemo(
    () => ({ createFolder, renameFolder, deleteFolder, renameFile, moveFile, removeFile, restoreFile, emptyTrash }),
    [createFolder, renameFolder, deleteFolder, renameFile, moveFile, removeFile, restoreFile, emptyTrash],
  )
}

/** Presigned PUT for a workspace avatar (display also goes through presigned GETs). */
export function useAvatarUpload() {
  const presignAvatar = useCoreAction(coreApi.drive.presignAvatar)
  return React.useCallback(
    async (workspaceId: Id<"workspaces">, file: File | Blob) => {
      const contentType = file.type || "image/png"
      const { uploadUrl, s3Key } = await presignAvatar({ workspaceId, contentType })
      await putWithProgress(uploadUrl, file, contentType)
      return { s3Key }
    },
    [presignAvatar],
  )
}
