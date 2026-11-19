import { parentPort } from 'worker_threads';
import path from 'path';
import koffi from 'koffi';

export interface ActiveWindowSample {
  hwnd: number;
  appName: string;
  executableName: string;
  processPath: string;
  windowTitle: string;
  processId: number;
}

interface ProbeRequest {
  id: number;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

const CANONICAL_APP_NAMES: Record<string, string> = {
  code: 'Code',
  'code - insiders': 'Code Insiders',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  antigravity: 'Antigravity',
  figma: 'Figma',
  figma_agent: 'Figma',
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  brave: 'Brave',
  firefox: 'Firefox',
  opera: 'Opera',
  opera_gx: 'Opera GX',
  vivaldi: 'Vivaldi',
  arc: 'Arc',
  slack: 'Slack',
  discord: 'Discord',
  teams: 'Microsoft Teams',
  'ms-teams': 'Microsoft Teams',
  zoom: 'Zoom',
  notion: 'Notion',
  obsidian: 'Obsidian',
  linear: 'Linear',
  ticktick: 'TickTick',
  spotify: 'Spotify',
  windowsterminal: 'Windows Terminal',
  wt: 'Windows Terminal',
  powershell: 'PowerShell',
  pwsh: 'PowerShell',
  cmd: 'Command Prompt',
  explorer: 'Explorer',
  postman: 'Postman',
  insomnia: 'Insomnia',
  devenv: 'Visual Studio',
  webstorm64: 'WebStorm',
  pycharm64: 'PyCharm',
  idea64: 'IntelliJ IDEA',
  rider64: 'Rider',
  goland64: 'GoLand',
  clion64: 'CLion',
  datagrip64: 'DataGrip',
  dbeaver: 'DBeaver',
  photoshop: 'Adobe Photoshop',
  illustrator: 'Adobe Illustrator',
  afterfx: 'Adobe After Effects',
  winword: 'Microsoft Word',
  excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  onenote: 'OneNote',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  steam: 'Steam',
  steamwebhelper: 'Steam',
  valorant: 'Valorant',
  'valorant-win64-shipping': 'Valorant',
  leagueclient: 'League of Legends',
  riotclientservices: 'Riot Client',
  epicgameslauncher: 'Epic Games',
  electron: 'Sheldon Focus',
  'sheldon focus': 'Sheldon Focus',
};

function normalizeAppName(processPath: string): string {
  if (!processPath) return 'Desconhecido';
  const stem = path.parse(processPath).name.trim();
  if (!stem) return 'Desconhecido';
  const mapped = CANONICAL_APP_NAMES[stem.toLowerCase()];
  if (mapped) return mapped;
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

class Win32WindowProbe {
  private readonly getForegroundWindow: () => number;
  private readonly getWindowTextLengthW: (hwnd: number) => number;
  private readonly getWindowTextW: (hwnd: number, buf: Buffer, maxCount: number) => number;
  private readonly getWindowThreadProcessId: (hwnd: number, pidOut: number[]) => number;
  private readonly enumChildWindows: (hwndParent: number, cb: unknown, lParam: number) => boolean;
  private readonly openProcess: (access: number, inherit: boolean, pid: number) => number;
  private readonly queryFullProcessImageNameW: (
    hProc: number,
    flags: number,
    buf: Buffer,
    sizeInOut: number[]
  ) => boolean;
  private readonly closeHandle: (handle: number) => boolean;

  private readonly enumCallback: unknown;
  private targetOuterPid = 0;
  private resolvedInnerPid = 0;

  // Reusable scratch buffers to keep GC allocations near zero during 1-2s polling
  private readonly titleBuffer = Buffer.alloc(4096);
  private readonly pathBuffer = Buffer.alloc(4096);
  private readonly pidScratch: number[] = [0];
  private readonly childPidScratch: number[] = [0];
  private readonly sizeScratch: number[] = [2048];

  constructor() {
    const user32 = koffi.load('user32.dll');
    const kernel32 = koffi.load('kernel32.dll');

    const EnumWindowsProc = koffi.proto(
      'bool __stdcall EnumWindowsProc(uintptr_t hwnd, uintptr_t lParam)'
    );

    this.getForegroundWindow = user32.func('uintptr_t __stdcall GetForegroundWindow()');
    this.getWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(uintptr_t hWnd)');
    this.getWindowTextW = user32.func(
      'int __stdcall GetWindowTextW(uintptr_t hWnd, _Out_ char16_t* lpString, int nMaxCount)'
    );
    this.getWindowThreadProcessId = user32.func(
      'uint32_t __stdcall GetWindowThreadProcessId(uintptr_t hWnd, _Out_ uint32_t* lpdwProcessId)'
    );
    this.enumChildWindows = user32.func(
      'bool __stdcall EnumChildWindows(uintptr_t hWndParent, EnumWindowsProc* lpEnumFunc, uintptr_t lParam)'
    );

    this.openProcess = kernel32.func(
      'uintptr_t __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)'
    );
    this.queryFullProcessImageNameW = kernel32.func(
      'bool __stdcall QueryFullProcessImageNameW(uintptr_t hProcess, uint32_t dwFlags, _Out_ char16_t* lpExeName, _Inout_ uint32_t* lpdwSize)'
    );
    this.closeHandle = kernel32.func('bool __stdcall CloseHandle(uintptr_t hObject)');

    this.enumCallback = koffi.register((childHwnd: number) => {
      this.childPidScratch[0] = 0;
      this.getWindowThreadProcessId(childHwnd, this.childPidScratch);
      const childPid = this.childPidScratch[0];
      if (childPid && childPid !== this.targetOuterPid) {
        this.resolvedInnerPid = childPid;
        return false; // Stop enumerating once real UWP hosted process is found
      }
      return true;
    }, koffi.pointer(EnumWindowsProc));
  }

  private readProcessPath(pid: number): string {
    if (!pid) return '';
    const hProcess = this.openProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    if (!hProcess) return '';
    try {
      this.sizeScratch[0] = this.pathBuffer.length / 2;
      const ok = this.queryFullProcessImageNameW(hProcess, 0, this.pathBuffer, this.sizeScratch);
      if (!ok || this.sizeScratch[0] <= 0) return '';
      return this.pathBuffer.toString('utf16le', 0, this.sizeScratch[0] * 2);
    } finally {
      this.closeHandle(hProcess);
    }
  }

  private readWindowTitle(hwnd: number): string {
    const rawLen = this.getWindowTextLengthW(hwnd);
    const maxChars = Math.min(rawLen + 1, this.titleBuffer.length / 2);
    if (maxChars <= 1) return '';
    const copiedChars = this.getWindowTextW(hwnd, this.titleBuffer, maxChars);
    if (copiedChars <= 0) return '';
    return this.titleBuffer.toString('utf16le', 0, copiedChars * 2).trim();
  }

  sampleForegroundWindow(): ActiveWindowSample | null {
    const hwnd = this.getForegroundWindow();
    if (!hwnd) return null;

    this.pidScratch[0] = 0;
    this.getWindowThreadProcessId(hwnd, this.pidScratch);
    let pid = this.pidScratch[0];
    if (!pid) return null;

    const windowTitle = this.readWindowTitle(hwnd);
    let processPath = this.readProcessPath(pid);

    // Resolve UWP Store apps hosted inside ApplicationFrameHost.exe
    if (
      processPath &&
      path.basename(processPath).toLowerCase() === 'applicationframehost.exe'
    ) {
      this.targetOuterPid = pid;
      this.resolvedInnerPid = 0;
      this.enumChildWindows(hwnd, this.enumCallback, 0);
      if (this.resolvedInnerPid) {
        const innerPath = this.readProcessPath(this.resolvedInnerPid);
        if (innerPath) {
          pid = this.resolvedInnerPid;
          processPath = innerPath;
        }
      }
    }

    if (!processPath && !windowTitle) return null;

    const appName = normalizeAppName(processPath);
    const executableName = processPath ? path.basename(processPath) : '';
    return {
      hwnd,
      appName,
      executableName,
      processPath,
      windowTitle: windowTitle || appName,
      processId: pid,
    };
  }
}

if (parentPort) {
  let probe: Win32WindowProbe | null = null;
  try {
    if (process.platform === 'win32') {
      probe = new Win32WindowProbe();
    }
  } catch (err) {
    console.error('[Win32ProbeWorker] Falha ao carregar Win32 APIs via koffi:', err);
  }

  parentPort.on('message', (msg: ProbeRequest) => {
    try {
      const window = probe ? probe.sampleForegroundWindow() : null;
      parentPort?.postMessage({ id: msg.id, window });
    } catch (err) {
      parentPort?.postMessage({
        id: msg.id,
        window: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
