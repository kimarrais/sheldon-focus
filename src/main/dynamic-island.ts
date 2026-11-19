import { BrowserWindow, screen } from 'electron';
import path from 'path';
import type { DynamicIslandState, NowPlayingMedia } from '../shared/types';
import type { SheldonStore } from './store';

const ISLAND_MAX_WIDTH = 1040;
const ISLAND_HEIGHT = 360;

export class DynamicIslandManager {
  private window: BrowserWindow | null = null;
  private state: DynamicIslandState;
  private readonly store: SheldonStore;

  constructor(store: SheldonStore) {
    this.store = store;
    this.state = {
      tasks: [],
      agendaEvents: [],
      selectedTaskId: null,
      remainingSeconds: 25 * 60,
      totalSeconds: 25 * 60,
      isRunning: false,
      cycleCount: 1,
      sheldonState: 'happy',
      isSentinelActive: false,
      warningsCount: 0,
      patienceLevel: 82,
      focusSecondsElapsed: 0,
      quickNote: store.getQuickNote(),
      introPlayed: false,
      replayIntroNonce: 0,
      activeNotification: null,
      isVisible: true,
      alwaysOnTop: true,
      nowPlaying: null,
    };

    const reposition = () => this.positionWindow();
    screen.on('display-metrics-changed', reposition);
    screen.on('display-added', reposition);
    screen.on('display-removed', reposition);
  }

  private getTargetBounds(): Electron.Rectangle {
    const { bounds } = screen.getPrimaryDisplay();
    const width = Math.min(ISLAND_MAX_WIDTH, bounds.width);
    const x = bounds.x + Math.round((bounds.width - width) / 2);
    const y = bounds.y;
    return { x, y, width, height: ISLAND_HEIGHT };
  }

  private positionWindow(): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setBounds(this.getTargetBounds());
  }

  public getState(): DynamicIslandState {
    return this.state;
  }

  public show(): void {
    this.state.isVisible = true;
    if (this.window && !this.window.isDestroyed()) {
      this.positionWindow();
      if (!this.window.isVisible()) {
        this.window.showInactive();
      }
      this.pushState();
      return;
    }

    const rect = this.getTargetBounds();

    this.window = new BrowserWindow({
      ...rect,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      alwaysOnTop: this.state.alwaysOnTop,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: true,
      show: false,
      title: 'Sheldon Dynamic Island',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    });

    this.window.setMenu(null);
    this.applyAlwaysOnTop(this.state.alwaysOnTop);
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.window.setIgnoreMouseEvents(true, { forward: true });

    this.window.on('blur', () => {
      if (!this.window || this.window.isDestroyed()) return;
      this.window.setIgnoreMouseEvents(true, { forward: true });
      this.window.webContents.send('island:blurred');
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    this.window.webContents.on('did-finish-load', () => {
      this.pushState();
      if (this.state.isVisible && this.window && !this.window.isDestroyed()) {
        this.window.showInactive();
      }
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      const separator = devServerUrl.includes('?') ? '&' : '?';
      void this.window.loadURL(`${devServerUrl}${separator}window=island`);
    } else {
      void this.window.loadFile(path.join(__dirname, '../../dist/index.html'), {
        query: { window: 'island' },
      });
    }
  }

  public hide(): void {
    this.state.isVisible = false;
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  public updateState(patch: Partial<DynamicIslandState>): void {
    this.state = {
      ...this.state,
      ...patch,
      // Keep store-persisted fields authoritative unless explicitly set
      introPlayed:
        typeof patch.introPlayed === 'boolean' ? patch.introPlayed : this.state.introPlayed,
      quickNote:
        typeof patch.quickNote === 'string' ? patch.quickNote : this.state.quickNote,
    };

    if (typeof patch.alwaysOnTop === 'boolean') {
      this.applyAlwaysOnTop(patch.alwaysOnTop);
    }

    if (patch.activeNotification && !this.window) {
      this.show();
    }

    this.pushState();
  }

  private pushState(): void {
    if (this.window && !this.window.isDestroyed() && !this.window.webContents.isLoading()) {
      this.window.webContents.send('island:state', this.state);
    }
  }

  public setIgnoreMouse(ignore: boolean): void {
    if (!this.window || this.window.isDestroyed()) return;
    if (ignore) {
      this.window.setIgnoreMouseEvents(true, { forward: true });
    } else {
      this.window.setIgnoreMouseEvents(false);
    }
  }

  public focus(): void {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.setIgnoreMouseEvents(false);
    this.window.focus();
  }

  public setAlwaysOnTop(alwaysOnTop: boolean): void {
    this.state.alwaysOnTop = alwaysOnTop;
    this.applyAlwaysOnTop(alwaysOnTop);
  }

  private applyAlwaysOnTop(flag: boolean): void {
    if (!this.window || this.window.isDestroyed()) return;
    if (flag) {
      this.window.setAlwaysOnTop(true, 'screen-saver');
    } else {
      this.window.setAlwaysOnTop(false);
    }
  }

  public markIntroPlayed(played: boolean): void {
    this.store.setIslandIntroPlayed(played);
    this.state.introPlayed = played;
    this.pushState();
  }

  public updateMedia(media: NowPlayingMedia): void {
    this.state.nowPlaying = media;
    this.pushState();
  }

  public saveQuickNote(note: string): void {
    this.store.setQuickNote(note);
    this.state.quickNote = note;
  }

  public destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}
