import { app, BrowserWindow, screen } from 'electron';
import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/* Overlay windows: Estágio 1 (advertência) e Estágio 2 (guilhotina)   */
/* ------------------------------------------------------------------ */

export interface LockdownItem {
  executable: string;
  startedAt: number;
  endsAt: number;
}

export interface LockdownPayload {
  items: LockdownItem[];
  taskkillEnabled: boolean;
}

const CRYING_ASSET = 'sheldon-crying.png';
const ANGRY_ASSET = 'sheldon-angry.png';
const WARNING_SIZE = { width: 520, height: 196 };
const WARNING_MARGIN = 16;

const SAFE_WEB_PREFERENCES: Electron.WebPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  devTools: false,
  spellcheck: false,
};

const CSP =
  "default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

const SHARED_SCRIPT = `
  const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const img = document.getElementById('sheldon');
  const fallback = () => {
    const d = document.createElement('div');
    d.className = 'fallback';
    d.textContent = '😱';
    img.replaceWith(d);
  };
  img.addEventListener('error', fallback);
  if (img.complete && img.naturalWidth === 0) fallback();
`;

const WARNING_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${CSP}" />
<title>Sheldon Focus — Advertência</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: transparent; overflow: hidden; user-select: none;
    font-family: 'Segoe UI', Inter, system-ui, sans-serif; color: #FDE6C4; }
  .card { height: 100%; display: flex; gap: 16px; align-items: center; padding: 16px 20px;
    background: #181311; border: 2px solid #F97316; border-radius: 22px;
    -webkit-app-region: drag; animation: shake .45s ease-in-out 2; }
  #sheldon, .fallback { width: 128px; height: 128px; flex-shrink: 0; object-fit: contain;
    filter: drop-shadow(0 6px 16px rgba(249,115,22,.35)); }
  .fallback { font-size: 84px; display: grid; place-items: center; }
  .badge { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #F97316; font-weight: 800; }
  .msg { margin-top: 6px; font-size: 15px; line-height: 1.45; font-weight: 600; color: #FFF7ED; }
  .exe { color: #FBBF24; font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace; }
  .foot { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .timer { font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace; font-size: 12px; color: #B8A99E; }
  .timer b { color: #F97316; font-size: 16px; font-variant-numeric: tabular-nums; }
  button { -webkit-app-region: no-drag; background: #F97316; color: #2A1506; font-weight: 700; border: 1px solid #FDBA74;
    border-radius: 12px; padding: 6px 14px; font-size: 12px; cursor: pointer; }
  button:hover { background: #EA580C; }
  @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
</style>
</head>
<body>
  <div class="card">
    <img id="sheldon" src="${CRYING_ASSET}" alt="Sheldon chorando" />
    <div>
      <div class="badge">😿 Sheldon Chorando de Decepção</div>
      <p class="msg">Você abriu <span class="exe" id="exe"></span>. Salve e feche agora ou o Sheldon vai ficar PISTOLA!</p>
      <div class="foot">
        <span class="timer">Guilhotina em <b id="t">--:--</b></span>
        <button id="ok">Entendido</button>
      </div>
    </div>
  </div>
<script>
  ${SHARED_SCRIPT}
  const q = new URLSearchParams(location.search);
  document.getElementById('exe').textContent = q.get('exe') || 'um processo proibido';
  const deadline = Number(q.get('deadline')) || Date.now();
  const t = document.getElementById('t');
  const tick = () => { t.textContent = fmt(deadline - Date.now()); };
  tick();
  setInterval(tick, 250);
  document.getElementById('ok').addEventListener('click', () => window.close());
</script>
</body>
</html>`;

const LOCKDOWN_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${CSP}" />
<title>Sheldon Focus — Modo Guilhotina</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: radial-gradient(circle at 50% 30%, #1f0b38 0%, #0d0517 65%, #07020d 100%);
    overflow: hidden; user-select: none; cursor: default;
    font-family: 'Plus Jakarta Sans', 'Segoe UI', Inter, system-ui, sans-serif; color: #F5E8FF; }
  .wrap { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2.5vh; padding: 4vh 4vw; text-align: center; }
  .card-guillotine {
    background: rgba(22, 10, 38, 0.75);
    border: 1.5px solid rgba(168, 85, 247, 0.45);
    border-radius: 32px;
    padding: 36px 48px;
    box-shadow: 0 20px 80px rgba(147, 51, 234, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(24px);
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 720px;
    width: 90%;
  }
  .header-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(168, 85, 247, 0.18);
    border: 1px solid rgba(217, 70, 239, 0.35);
    padding: 8px 18px;
    border-radius: 999px;
    margin-bottom: 20px;
  }
  .header-icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: #A855F7;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 14px;
  }
  .header-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #F0ABFC;
  }
  #sheldon, .fallback { height: min(20vh, 180px); width: auto; object-fit: contain;
    filter: drop-shadow(0 10px 40px rgba(192, 38, 211, 0.5)); margin-bottom: 8px; }
  .fallback { font-size: min(16vh, 140px); line-height: 1; }
  
  /* Soundwave equalizer bars from Image 3 */
  .soundwave {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    height: 38px;
    margin: 10px 0 16px;
    width: 280px;
  }
  .soundwave-bar {
    width: 4px;
    border-radius: 999px;
    background: linear-gradient(180deg, #F43F5E, #D946EF 60%, #9333EA);
    animation: bounceBar 1.2s ease-in-out infinite alternate;
  }
  @keyframes bounceBar {
    0% { height: 6px; opacity: 0.4; }
    50% { height: 34px; opacity: 1; }
    100% { height: 12px; opacity: 0.6; }
  }

  .timer { font-family: 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace;
    font-variant-numeric: tabular-nums; font-weight: 800; line-height: 1; color: #FFFFFF;
    font-size: min(16vw, 110px); letter-spacing: -.03em;
    text-shadow: 0 0 50px rgba(217, 70, 239, 0.65), 0 0 100px rgba(168, 85, 247, 0.35); }
  .timer.critical { animation: pulse 0.8s ease-in-out infinite; color: #F43F5E; text-shadow: 0 0 60px rgba(244, 63, 94, 0.8); }
  
  .sub-status { font-size: 14px; font-weight: 600; color: #D8B4FE; margin-top: 6px; letter-spacing: .02em; }
  .msg { font-size: 15px; font-weight: 500; max-width: 54ch; line-height: 1.5; color: #E9D5FF; margin-top: 14px; }
  .exe { color: #F0ABFC; font-family: 'JetBrains Mono', Consolas, monospace; font-weight: 700; }
  code { color: #F43F5E; background: rgba(244, 63, 94, 0.15); padding: 2px 6px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-weight: 700; }

  .bar { width: 100%; max-width: 460px; height: 8px; background: rgba(88, 28, 135, 0.35); border-radius: 999px; overflow: hidden; margin-top: 16px; border: 1px solid rgba(168, 85, 247, 0.3); }
  #fill { height: 100%; width: 0%; background: linear-gradient(90deg, #9333EA, #D946EF, #F43F5E); transition: width .25s linear; }
  
  .action-btn {
    margin-top: 22px;
    background: linear-gradient(135deg, #9333EA 0%, #C026D3 100%);
    border: 1px solid rgba(240, 171, 252, 0.4);
    color: #FFFFFF;
    font-weight: 700;
    font-size: 14px;
    padding: 12px 28px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 8px 24px rgba(192, 38, 211, 0.45);
    letter-spacing: .02em;
  }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .7; transform: scale(1.02); } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card-guillotine">
      <div class="header-pill">
        <span class="header-icon">⚔️</span>
        <span class="header-title">Modo Guilhotina Ativado • Sheldon Implacável</span>
      </div>

      <img id="sheldon" src="${ANGRY_ASSET}" alt="Sheldon bravo" />

      <!-- Neon soundwave equalizer bars (Image 3 inspired) -->
      <div class="soundwave" id="wave"></div>

      <div id="timer" class="timer">05:00</div>
      <div class="sub-status">Tempo restante antes da execução sumária</div>

      <p class="msg" id="msg"></p>
      <div class="bar"><div id="fill"></div></div>

      <div class="action-btn">
        <span>Feche o jogo imediatamente</span>
        <span>→</span>
      </div>
    </div>
  </div>
<script>
  ${SHARED_SCRIPT}
  // Generate 32 soundwave bars with random animation delays
  const wave = document.getElementById('wave');
  if (wave) {
    for (let i = 0; i < 32; i++) {
      const b = document.createElement('div');
      b.className = 'soundwave-bar';
      b.style.animationDelay = (-(i * 0.08) % 1.2) + 's';
      b.style.animationDuration = (0.7 + (i % 5) * 0.15) + 's';
      wave.appendChild(b);
    }
  }

  let state = { items: [], taskkillEnabled: true };
  try { state = JSON.parse(new URLSearchParams(location.search).get('data') || '{}'); } catch (e) {}
  const timerEl = document.getElementById('timer');
  const fillEl = document.getElementById('fill');
  const msgEl = document.getElementById('msg');

  function renderMessage() {
    msgEl.textContent = '';
    const names = (state.items || []).map((i) => i.executable);
    const exe = document.createElement('span');
    exe.className = 'exe';
    exe.textContent = names.length ? names.join(', ') : 'o processo proibido';
    if (state.taskkillEnabled) {
      const code = document.createElement('code');
      code.textContent = 'taskkill /F';
      msgEl.append('Quando o cronômetro zerar, ', exe, ' será encerrado à força via ', code, '. Salve seu trabalho em outros apps e feche-o!');
    } else {
      msgEl.append('Estação bloqueada enquanto ', exe, ' estiver aberto. O Sheldon registrou tudo no Black Mirror.');
    }
  }

  function tick() {
    const items = state.items || [];
    if (!items.length) return;
    const target = items.reduce((a, b) => (a.endsAt <= b.endsAt ? a : b));
    const remaining = target.endsAt - Date.now();
    const total = Math.max(1, target.endsAt - target.startedAt);
    timerEl.textContent = fmt(remaining);
    timerEl.classList.toggle('critical', remaining <= 60000);
    fillEl.style.width = Math.min(100, Math.max(0, (1 - remaining / total) * 100)) + '%';
  }

  window.__sheldonUpdate = (next) => { state = next; renderMessage(); tick(); };
  renderMessage();
  tick();
  setInterval(tick, 250);
</script>
</body>
</html>`;

function findAssetFile(fileName: string): string | null {
  const stem = path.parse(fileName).name;
  const hashed = new RegExp(`^${stem}(-[\\w-]+)?\\.png$`, 'i');
  const appPath = app.getAppPath();
  const dirs = [
    path.join(__dirname, '../../src/renderer/assets'),
    path.join(__dirname, '../../dist/assets'),
    path.join(appPath, 'src/renderer/assets'),
    path.join(appPath, 'dist/assets'),
    path.join(process.resourcesPath || '', 'assets'),
  ];

  for (const dir of dirs) {
    try {
      const exact = path.join(dir, fileName);
      if (fs.existsSync(exact)) return exact;
      if (!fs.existsSync(dir)) continue;
      // Vite emits hashed file names in production builds (e.g. sheldon-shocked-a1b2c3.png)
      const match = fs.readdirSync(dir).find((f) => hashed.test(f));
      if (match) return path.join(dir, match);
    } catch {
      // try next candidate
    }
  }
  return null;
}

function hardenWindow(win: BrowserWindow): void {
  win.setMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}

export class OverlayManager {
  private readonly overlayDir: string;
  private readonly warningWindows = new Map<string, BrowserWindow>();
  private readonly lockdownWindows = new Map<number, BrowserWindow>();
  private lockdownPayload: LockdownPayload | null = null;

  constructor() {
    this.overlayDir = path.join(app.getPath('userData'), 'overlays');
    this.prepareOverlayFiles();

    screen.on('display-added', (_event, display) => {
      if (this.lockdownPayload) this.createLockdownWindow(display);
    });
    screen.on('display-removed', (_event, display) => {
      const win = this.lockdownWindows.get(display.id);
      if (win && !win.isDestroyed()) win.destroy();
      this.lockdownWindows.delete(display.id);
    });
    screen.on('display-metrics-changed', (_event, display) => {
      const win = this.lockdownWindows.get(display.id);
      if (win && !win.isDestroyed()) win.setBounds(display.bounds);
    });
  }

  get isLockdownActive(): boolean {
    return this.lockdownPayload !== null;
  }

  /** Writes overlay HTML + Sheldon assets to userData (the image is too large for a data: URL). */
  private prepareOverlayFiles(): void {
    try {
      fs.mkdirSync(this.overlayDir, { recursive: true });
      fs.writeFileSync(path.join(this.overlayDir, 'warning.html'), WARNING_HTML, 'utf-8');
      fs.writeFileSync(path.join(this.overlayDir, 'lockdown.html'), LOCKDOWN_HTML, 'utf-8');

      for (const assetName of [CRYING_ASSET, ANGRY_ASSET]) {
        const source = findAssetFile(assetName);
        const target = path.join(this.overlayDir, assetName);
        if (source) {
          const needsCopy =
            !fs.existsSync(target) || fs.statSync(target).size !== fs.statSync(source).size;
          if (needsCopy) fs.copyFileSync(source, target);
        } else {
          console.warn(`[Sheldon Overlay] ${assetName} não encontrado — usando fallback emoji.`);
        }
      }
    } catch (err) {
      console.error('[Sheldon Overlay] Falha ao preparar arquivos de overlay:', err);
    }
  }

  /* --------------------------- Estágio 1 --------------------------- */

  showWarning(key: string, executable: string, escalatesAt: number): void {
    const existing = this.warningWindows.get(key);
    if (existing && !existing.isDestroyed()) {
      existing.showInactive();
      return;
    }

    const win = new BrowserWindow({
      ...WARNING_SIZE,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: 'Sheldon Focus — Advertência',
      webPreferences: SAFE_WEB_PREFERENCES,
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    hardenWindow(win);

    this.warningWindows.set(key, win);
    win.on('closed', () => {
      if (this.warningWindows.get(key) === win) this.warningWindows.delete(key);
      this.layoutWarnings();
    });
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      this.layoutWarnings();
      win.show();
      win.moveTop();
    });

    void win.loadFile(path.join(this.overlayDir, 'warning.html'), {
      query: { exe: executable, deadline: String(escalatesAt) },
    });
  }

  closeWarning(key: string): void {
    const win = this.warningWindows.get(key);
    this.warningWindows.delete(key);
    if (win && !win.isDestroyed()) win.destroy();
    this.layoutWarnings();
  }

  /** Stacks warning popups at the bottom-right corner of the primary display. */
  private layoutWarnings(): void {
    const { workArea } = screen.getPrimaryDisplay();
    let index = 0;
    for (const win of this.warningWindows.values()) {
      if (win.isDestroyed()) continue;
      const x = workArea.x + workArea.width - WARNING_SIZE.width - WARNING_MARGIN;
      const y =
        workArea.y +
        workArea.height -
        (WARNING_SIZE.height + WARNING_MARGIN) * (index + 1);
      win.setBounds({ x, y, ...WARNING_SIZE });
      index += 1;
    }
  }

  /* --------------------------- Estágio 2 --------------------------- */

  showLockdown(payload: LockdownPayload): void {
    this.lockdownPayload = payload;
    for (const display of screen.getAllDisplays()) {
      const win = this.lockdownWindows.get(display.id);
      if (win && !win.isDestroyed()) continue;
      this.createLockdownWindow(display);
    }
    this.updateLockdown(payload);
  }

  updateLockdown(payload: LockdownPayload): void {
    if (!this.lockdownPayload) return;
    this.lockdownPayload = payload;
    const script = `window.__sheldonUpdate && window.__sheldonUpdate(${JSON.stringify(payload)})`;
    for (const win of this.lockdownWindows.values()) {
      if (win.isDestroyed() || win.webContents.isLoading()) continue;
      win.webContents.executeJavaScript(script).catch(() => undefined);
    }
  }

  closeLockdown(): void {
    this.lockdownPayload = null;
    for (const win of this.lockdownWindows.values()) {
      if (!win.isDestroyed()) {
        win.setKiosk(false);
        win.destroy();
      }
    }
    this.lockdownWindows.clear();
  }

  private createLockdownWindow(display: Electron.Display): void {
    if (!this.lockdownPayload) return;
    const { bounds } = display;

    const win = new BrowserWindow({
      ...bounds,
      show: false,
      frame: false,
      backgroundColor: '#09090B',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      fullscreenable: true,
      title: 'Sheldon Focus — Guilhotina',
      webPreferences: SAFE_WEB_PREFERENCES,
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    hardenWindow(win);

    // Lockdown windows can only be removed programmatically (win.destroy()).
    win.on('close', (event) => event.preventDefault());
    win.on('minimize', () => {
      if (!win.isDestroyed()) win.restore();
    });
    win.on('blur', () => {
      if (win.isDestroyed() || !this.lockdownPayload) return;
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    });
    win.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase();
      if ((input.control && key === 'w') || (input.alt && key === 'f4') || key === 'f11') {
        event.preventDefault();
      }
    });
    win.webContents.on('did-finish-load', () => {
      if (this.lockdownPayload) this.updateLockdown(this.lockdownPayload);
    });
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return;
      // Bounds must be applied before kiosk so fullscreen lands on the right monitor.
      win.setBounds(bounds);
      win.show();
      win.setKiosk(true);
      win.focus();
    });

    this.lockdownWindows.set(display.id, win);
    void win.loadFile(path.join(this.overlayDir, 'lockdown.html'), {
      query: { data: JSON.stringify(this.lockdownPayload) },
    });
  }

  /** Must be called before quitting — lockdown windows block the normal close flow. */
  destroyAll(): void {
    for (const key of [...this.warningWindows.keys()]) this.closeWarning(key);
    this.closeLockdown();
  }
}
