/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO?: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
