/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Folder under /public holding papers.json, authors.json and embeddings.bin (default "data"). */
  readonly VITE_DATA_DIR?: string;
}
