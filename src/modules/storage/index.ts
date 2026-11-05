import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento privado. Implementação em disco, fora de /public.
 * Para produção pode ser substituída por S3/R2 mantendo esta interface.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

function root() {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

function resolveKey(key: string) {
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Chave de armazenamento inválida");
  return full;
}

export const storage: Storage = {
  async put(key, data) {
    const full = resolveKey(key);
    await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ full, data, { mode: 0o600 });
  },
  async get(key) {
    return readFile(/*turbopackIgnore: true*/ resolveKey(key));
  },
  async remove(key) {
    await rm(/*turbopackIgnore: true*/ resolveKey(key), { force: true });
  },
  async removePrefix(prefix) {
    await rm(/*turbopackIgnore: true*/ resolveKey(prefix), { recursive: true, force: true });
  },
};
