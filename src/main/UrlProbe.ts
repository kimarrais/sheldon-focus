import { app } from 'electron';
import {
  execFile,
  spawn,
  type ChildProcessByStdio,
} from 'child_process';
import type { Readable, Writable } from 'stream';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const URL_PROBE_CS_SOURCE = `using System;
using System.Collections.Generic;
using System.Text;
using System.Windows.Automation;

internal static class SheldonUrlProbe
{
    private static void Main()
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        string line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line == "EXIT") break;

            long hwndVal;
            if (!long.TryParse(line, out hwndVal) || hwndVal <= 0)
            {
                Console.WriteLine("{}");
                continue;
            }

            try
            {
                string url = TryExtractBrowserUrl(new IntPtr(hwndVal));
                if (string.IsNullOrEmpty(url))
                {
                    Console.WriteLine("{}");
                }
                else
                {
                    Console.WriteLine("{\\"url\\":\\"" + EscapeJson(url) + "\\"}");
                }
            }
            catch
            {
                Console.WriteLine("{}");
            }
        }
    }

    private static string TryExtractBrowserUrl(IntPtr hwnd)
    {
        AutomationElement root = AutomationElement.FromHandle(hwnd);
        if (root == null) return null;

        var queue = new Queue<KeyValuePair<AutomationElement, int>>();
        queue.Enqueue(new KeyValuePair<AutomationElement, int>(root, 0));

        TreeWalker walker = TreeWalker.ControlViewWalker;
        int visited = 0;

        while (queue.Count > 0 && visited < 220)
        {
            var item = queue.Dequeue();
            AutomationElement el = item.Key;
            int depth = item.Value;
            visited++;

            ControlType ct;
            string autoId;
            string name;
            try
            {
                ct = el.Current.ControlType;
                autoId = el.Current.AutomationId ?? "";
                name = el.Current.Name ?? "";
            }
            catch
            {
                continue;
            }

            // Skip web content Document nodes so lookup stays < 8ms
            if (ct == ControlType.Document) continue;

            if (ct == ControlType.Edit)
            {
                bool looksLikeUrlBar =
                    autoId == "urlbar-input" ||
                    autoId.IndexOf("omnibox", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    autoId.IndexOf("address", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("address", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("endere", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("search or enter", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("pesquisar ou digitar", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("omnibox", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    name.IndexOf("barra de", StringComparison.OrdinalIgnoreCase) >= 0;

                if (looksLikeUrlBar)
                {
                    object patternObj;
                    if (el.TryGetCurrentPattern(ValuePattern.Pattern, out patternObj))
                    {
                        var vp = patternObj as ValuePattern;
                        string val = vp != null ? (vp.Current.Value ?? "").Trim() : "";
                        if (!string.IsNullOrEmpty(val) &&
                            (val.Contains(".") ||
                             val.StartsWith("http", StringComparison.OrdinalIgnoreCase) ||
                             val.StartsWith("localhost", StringComparison.OrdinalIgnoreCase)))
                        {
                            return val;
                        }
                    }
                }
            }

            if (depth >= 8) continue;

            try
            {
                AutomationElement child = walker.GetFirstChild(el);
                int siblingCount = 0;
                while (child != null && siblingCount < 40)
                {
                    queue.Enqueue(new KeyValuePair<AutomationElement, int>(child, depth + 1));
                    child = walker.GetNextSibling(child);
                    siblingCount++;
                }
            }
            catch
            {
                // transient UIA tree change
            }
        }

        return null;
    }

    private static string EscapeJson(string s)
    {
        var sb = new StringBuilder(s.Length + 8);
        foreach (char c in s)
        {
            switch (c)
            {
                case '\\\\': sb.Append("\\\\\\\\"); break;
                case '"': sb.Append("\\\\\\""); break;
                case '\\n': sb.Append("\\\\n"); break;
                case '\\r': sb.Append("\\\\r"); break;
                case '\\t': sb.Append("\\\\t"); break;
                default:
                    if (c < 32) sb.AppendFormat("\\\\u{0:X4}", (int)c);
                    else sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
}
`;

const SENSITIVE_PARAMS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'secret',
  'password',
  'api_key',
  'apikey',
  'auth',
]);

export function sanitizeAndParseUrl(rawInput: string | null): {
  url: string | null;
  domain: string | null;
} {
  if (!rawInput) return { url: null, domain: null };
  let trimmed = rawInput.trim();
  if (!trimmed || trimmed.includes(' ')) return { url: null, domain: null };
  if (/^(about:|chrome:|edge:|brave:|moz-extension:|devtools:)/i.test(trimmed)) {
    return { url: trimmed.split('?')[0], domain: null };
  }

  if (!/^[a-z]+:\/\//i.test(trimmed)) {
    const isLocal = /^(localhost|127\.0\.0\.1)(?::\d+)?/i.test(trimmed);
    trimmed = `${isLocal ? 'http' : 'https'}://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, 'REDACTED');
      }
    }
    const cleanHost = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const domain =
      (cleanHost === 'localhost' || cleanHost === '127.0.0.1') && parsed.port
        ? `${cleanHost}:${parsed.port}`
        : cleanHost || null;

    return {
      url: parsed.toString(),
      domain,
    };
  } catch {
    return { url: null, domain: null };
  }
}

/**
 * Persistent Windows UIAutomation probe that extracts real active URLs
 * from Chrome, Edge, Brave, Firefox, Opera, Vivaldi, and Arc.
 */
export class BrowserUrlProbe {
  private exePath: string | null = null;
  private initPromise: Promise<string | null> | null = null;
  private child: ChildProcessByStdio<Writable, Readable, null> | null = null;
  private stdoutBuffer = '';
  private pendingResolve: ((url: string | null) => void) | null = null;
  private pendingTimer: NodeJS.Timeout | null = null;
  private busy = false;

  private lastCache: {
    hwnd: number;
    title: string;
    url: string | null;
    domain: string | null;
    fetchedAt: number;
  } | null = null;

  private async ensureCompiled(): Promise<string | null> {
    if (process.platform !== 'win32') return null;
    if (this.exePath && fs.existsSync(this.exePath)) return this.exePath;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const binDir = path.join(app.getPath('userData'), 'bin');
        fs.mkdirSync(binDir, { recursive: true });
        const csPath = path.join(binDir, 'sheldon-url-probe.cs');
        const outExe = path.join(binDir, 'sheldon-url-probe.exe');
        const hashPath = path.join(binDir, 'sheldon-url-probe.sha256');

        const sourceHash = crypto
          .createHash('sha256')
          .update(URL_PROBE_CS_SOURCE)
          .digest('hex');

        const existingHash = fs.existsSync(hashPath)
          ? fs.readFileSync(hashPath, 'utf-8').trim()
          : '';

        if (fs.existsSync(outExe) && existingHash === sourceHash) {
          this.exePath = outExe;
          return outExe;
        }

        const cscCandidates = [
          'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
          'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
        ];
        const csc = cscCandidates.find((p) => fs.existsSync(p));
        if (!csc) return null;

        const fwDir = path.dirname(csc);
        const wpfDir = path.join(fwDir, 'WPF');
        const uiAutoClient = path.join(wpfDir, 'UIAutomationClient.dll');
        const uiAutoTypes = path.join(wpfDir, 'UIAutomationTypes.dll');
        const windowsBase = path.join(wpfDir, 'WindowsBase.dll');

        if (!fs.existsSync(uiAutoClient) || !fs.existsSync(uiAutoTypes)) {
          return null;
        }

        fs.writeFileSync(csPath, URL_PROBE_CS_SOURCE, 'utf-8');
        await execFileAsync(
          csc,
          [
            '/nologo',
            '/optimize+',
            '/target:exe',
            `/out:${outExe}`,
            `/r:${uiAutoClient}`,
            `/r:${uiAutoTypes}`,
            `/r:${windowsBase}`,
            csPath,
          ],
          { windowsHide: true, timeout: 15_000 }
        );

        fs.writeFileSync(hashPath, sourceHash, 'utf-8');
        this.exePath = outExe;
        return outExe;
      } catch (err) {
        console.warn('[Sheldon UrlProbe] UIAutomation probe indisponível:', err);
        return null;
      }
    })();

    return this.initPromise;
  }

  private ensureProcess(
    exePath: string
  ): ChildProcessByStdio<Writable, Readable, null> | null {
    if (this.child && !this.child.killed && this.child.exitCode === null) {
      return this.child;
    }

    try {
      const proc = spawn(exePath, [], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });

      proc.stdout.setEncoding('utf8');
      proc.stdout.on('data', (chunk: string) => {
        this.stdoutBuffer += chunk;
        const nlIdx = this.stdoutBuffer.indexOf('\n');
        if (nlIdx >= 0) {
          const line = this.stdoutBuffer.slice(0, nlIdx).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(nlIdx + 1);
          this.resolvePending(line);
        }
      });

      proc.on('exit', () => {
        this.child = null;
        this.resolvePending('{}');
      });

      proc.on('error', () => {
        this.child = null;
        this.resolvePending('{}');
      });

      this.child = proc;
      return proc;
    } catch {
      return null;
    }
  }

  private resolvePending(line: string): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.busy = false;

    if (!resolve) return;
    try {
      const parsed = JSON.parse(line || '{}') as { url?: string };
      resolve(parsed.url || null);
    } catch {
      resolve(null);
    }
  }

  async getBrowserUrl(
    hwnd: number,
    windowTitle: string
  ): Promise<{ url: string | null; domain: string | null }> {
    if (!hwnd || process.platform !== 'win32') {
      return { url: null, domain: null };
    }

    const now = Date.now();
    if (
      this.lastCache &&
      this.lastCache.hwnd === hwnd &&
      this.lastCache.title === windowTitle &&
      now - this.lastCache.fetchedAt < 2500
    ) {
      return { url: this.lastCache.url, domain: this.lastCache.domain };
    }

    const exe = await this.ensureCompiled();
    if (!exe) return { url: null, domain: null };

    const proc = this.ensureProcess(exe);
    if (!proc || this.busy) {
      return {
        url: this.lastCache?.hwnd === hwnd ? this.lastCache.url : null,
        domain: this.lastCache?.hwnd === hwnd ? this.lastCache.domain : null,
      };
    }

    const rawUrl = await new Promise<string | null>((resolve) => {
      this.busy = true;
      this.pendingResolve = resolve;
      this.pendingTimer = setTimeout(() => {
        this.resolvePending('{}');
      }, 280);
      try {
        proc.stdin.write(`${hwnd}\n`);
      } catch {
        this.resolvePending('{}');
      }
    });

    const parsed = sanitizeAndParseUrl(rawUrl);
    this.lastCache = {
      hwnd,
      title: windowTitle,
      url: parsed.url,
      domain: parsed.domain,
      fetchedAt: Date.now(),
    };
    return parsed;
  }

  stop(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingResolve = null;
    this.busy = false;
    if (this.child && !this.child.killed) {
      try {
        this.child.stdin.write('EXIT\n');
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (this.child && !this.child.killed) {
          this.child.kill();
        }
      }, 200);
    }
  }
}
