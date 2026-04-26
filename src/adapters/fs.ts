import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { recordSelfWrite } from './selfWrites'

export interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  is_file: boolean
  /** mtime in ms since UNIX epoch; 0 if unavailable. */
  mtime: number
  /** File size in bytes; 0 for directories or when unavailable. */
  size: number
}

export interface FsChange {
  kind: 'create' | 'modify' | 'remove' | 'other'
  paths: string[]
}

export interface ProjectHit {
  path: string
  has_claude_md: boolean
  has_claude_dir: boolean
}

export const fs = {
  homeDir: (): Promise<string> => invoke('home_dir'),
  readText: (path: string): Promise<string> => invoke('read_text', { path }),
  writeText: (path: string, contents: string): Promise<void> => {
    recordSelfWrite(path)
    return invoke('write_text', { path, contents })
  },
  readJson: <T = unknown>(path: string): Promise<T> => invoke('read_json', { path }),
  writeJson: (path: string, value: unknown): Promise<void> => {
    recordSelfWrite(path)
    return invoke('write_json', { path, value })
  },
  pathExists: (path: string): Promise<boolean> => invoke('path_exists', { path }),
  ensureDir: (path: string): Promise<void> => invoke('ensure_dir', { path }),
  removePath: (path: string): Promise<void> => {
    recordSelfWrite(path)
    return invoke('remove_path', { path })
  },
  renamePath: (from: string, to: string): Promise<void> => {
    recordSelfWrite(from)
    recordSelfWrite(to)
    return invoke('rename_path', { from, to })
  },
  listDir: (path: string): Promise<DirEntry[]> => invoke('list_dir', { path }),
  listDirRecursive: (path: string, maxDepth?: number): Promise<DirEntry[]> =>
    invoke('list_dir_recursive', { path, maxDepth }),
  /**
   * Parallel, gitignore-aware walk that returns every file whose basename
   * equals `name`. Skips node_modules/target/.git/dist/build/etc. Prefer this
   * over `listDirRecursive(...).filter(...)` for targeted lookups.
   */
  findFilesNamed: (
    root: string,
    name: string,
    maxDepth?: number,
  ): Promise<DirEntry[]> => invoke('find_files_named', { root, name, maxDepth }),
  watchPaths: (paths: string[]): Promise<void> => invoke('watch_paths', { paths }),
  unwatchAll: (): Promise<void> => invoke('unwatch_all'),
  scanForProjects: (root: string, maxDepth?: number): Promise<ProjectHit[]> =>
    invoke('scan_for_projects', { root, maxDepth }),
  onChange: (cb: (ev: FsChange) => void): Promise<UnlistenFn> =>
    listen<FsChange>('fs:change', (e) => cb(e.payload)),
  runCommand: (
    program: string,
    args: string[],
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exit_code: number }> =>
    invoke('run_command', { program, args, timeoutMs }),
  runClaudeCli: (
    args: string[],
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exit_code: number }> =>
    invoke('run_claude_cli', { args, timeoutMs }),
  openExternal: (target: string): Promise<void> => invoke('open_external', { target }),
}

export const readTextOrNull = async (path: string): Promise<string | null> => {
  try {
    return await fs.readText(path)
  } catch {
    return null
  }
}

export const readJsonOrNull = async <T = unknown>(path: string): Promise<T | null> => {
  try {
    return await fs.readJson<T>(path)
  } catch {
    return null
  }
}

export const join = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((p) => p.replace(/[\/\\]+$/, ''))
    .join('/')
    .replace(/\/+/g, '/')

export const basename = (p: string): string =>
  p.replace(/[\/\\]+$/, '').split(/[\/\\]/).pop() ?? p

export const dirname = (p: string): string => {
  const parts = p.replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export const stripExt = (name: string, ext: string): string =>
  name.endsWith(ext) ? name.slice(0, -ext.length) : name
