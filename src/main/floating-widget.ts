import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';

export interface FloatingWidgetState {
  title: string;
  remainingSeconds: number;
  isRunning: boolean;
}

export class FloatingWidgetManager {
  private window: BrowserWindow | null = null;
  private state: FloatingWidgetState = {
    title: 'Nenhuma tarefa ativa',
    remainingSeconds: 25 * 60,
    isRunning: false,
  };
  private onActionCallback: ((action: 'toggle' | 'close' | 'skip') => void) | null = null;

  public setOnAction(cb: (action: 'toggle' | 'close' | 'skip') => void): void {
    this.onActionCallback = cb;
  }

  public show(initialState?: Partial<FloatingWidgetState>): void {
    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }

    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.webContents.send('widget:sync-state', this.state);
      return;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const widgetWidth = 310;
    const widgetHeight = 150;
    const x = Math.max(20, width - widgetWidth - 28);
    const y = Math.max(20, height - widgetHeight - 28);

    this.window = new BrowserWindow({
      width: widgetWidth,
      height: widgetHeight,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: false,
      hasShadow: true,
      title: 'Sheldon Focus Timer',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const CSP = "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'";

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${CSP}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    height: 100vh;
    padding: 8px;
    background: transparent;
    user-select: none;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: #F8FAFC;
    overflow: hidden;
  }
  .card {
    height: 100%;
    background: rgba(15, 11, 24, 0.92);
    border: 1.5px solid rgba(168, 85, 247, 0.5);
    border-radius: 20px;
    padding: 12px 14px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.65), 0 0 20px rgba(168, 85, 247, 0.25);
    backdrop-filter: blur(16px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    -webkit-app-region: drag;
  }
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sheldon-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    color: #F0ABFC;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #A855F7;
    box-shadow: 0 0 8px #A855F7;
  }
  .dot.active {
    background: #10B981;
    box-shadow: 0 0 8px #10B981;
    animation: pulse 1.5s infinite;
  }
  .task-title {
    font-size: 12px;
    font-weight: 600;
    color: #E2E8F0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
  .close-btn {
    -webkit-app-region: no-drag;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: #94A3B8;
    width: 22px;
    height: 22px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  .close-btn:hover {
    background: #EF4444;
    color: #FFF;
  }
  .body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 32px;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: -0.03em;
    text-shadow: 0 0 20px rgba(217, 70, 239, 0.5);
    line-height: 1;
  }
  .controls {
    -webkit-app-region: no-drag;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ctrl-btn {
    background: linear-gradient(135deg, #9333EA, #C026D3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #FFF;
    font-weight: 700;
    font-size: 12px;
    padding: 7px 14px;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);
    transition: transform 0.15s, opacity 0.15s;
  }
  .ctrl-btn:hover {
    opacity: 0.95;
    transform: scale(1.03);
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
</head>
<body>
  <div class="card">
    <div class="top-bar">
      <div class="sheldon-tag">
        <span class="dot" id="dot"></span>
        <span>Sheldon Pomodoro</span>
      </div>
      <button class="close-btn" id="close" title="Fechar widget (Reativar nas configurações)">✕</button>
    </div>

    <div class="task-title" id="title">Carregando...</div>

    <div class="body">
      <div class="timer" id="timer">25:00</div>
      <div class="controls">
        <button class="ctrl-btn" id="toggle">Pausar</button>
      </div>
    </div>
  </div>

  <script>
    let current = { title: '', remainingSeconds: 1500, isRunning: false };

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
    };

    const titleEl = document.getElementById('title');
    const timerEl = document.getElementById('timer');
    const toggleEl = document.getElementById('toggle');
    const dotEl = document.getElementById('dot');

    function render() {
      titleEl.textContent = current.title || 'Foco no Trabalho';
      timerEl.textContent = fmt(current.remainingSeconds);
      toggleEl.textContent = current.isRunning ? 'Pausar' : 'Iniciar';
      dotEl.className = 'dot' + (current.isRunning ? ' active' : '');
    }

    document.getElementById('close').addEventListener('click', () => {
      window.__notifyAction?.('close');
    });

    toggleEl.addEventListener('click', () => {
      window.__notifyAction?.('toggle');
    });

    window.__updateState = (next) => {
      current = Object.assign({}, current, next);
      render();
    };
  </script>
</body>
</html>`;

    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    this.window.webContents.on('did-finish-load', () => {
      this.update(this.state);
    });

    this.window.on('closed', () => {
      this.window = null;
    });
  }

  public hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  public update(state: Partial<FloatingWidgetState>): void {
    this.state = { ...this.state, ...state };
    if (this.window && !this.window.isDestroyed()) {
      const code = `window.__updateState && window.__updateState(${JSON.stringify(this.state)});`;
      this.window.webContents.executeJavaScript(code).catch(() => {});
    }
  }

  public dispatchAction(action: 'toggle' | 'close' | 'skip'): void {
    if (this.onActionCallback) {
      this.onActionCallback(action);
    }
  }
}
