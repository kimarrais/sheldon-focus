import fs from 'fs';
import path from 'path';
import { app } from 'electron';

let envLoaded = false;

/**
 * Lightweight, zero-dependency environment variable loader.
 * Reads `.env` and `.env.local` files from process.cwd() and the app root,
 * populating process.env without exposing secrets into the version control repository.
 */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;

  const candidatePaths: string[] = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
  ];

  try {
    if (app && typeof app.getAppPath === 'function') {
      const appRoot = app.getAppPath();
      candidatePaths.push(path.resolve(appRoot, '.env'));
      candidatePaths.push(path.resolve(appRoot, '.env.local'));
    }
  } catch {
    // App not ready or running outside Electron lifecycle
  }

  const seenPaths = new Set<string>();

  for (const filePath of candidatePaths) {
    if (seenPaths.has(filePath)) continue;
    seenPaths.add(filePath);

    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw.split(/\r?\n/);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx <= 0) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();

        // Strip enclosing quotes (single or double)
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }

        // Support escaped newlines inside double-quoted values
        val = val.replace(/\\n/g, '\n');

        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch (err) {
      console.warn(`[loadEnv] Falha ao ler arquivo de ambiente em ${filePath}:`, err);
    }
  }
}

