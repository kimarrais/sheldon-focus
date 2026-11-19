import { app } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execFile, ChildProcessWithoutNullStreams } from 'child_process';
import readline from 'readline';
import type { NowPlayingMedia } from '../shared/types';

const PROBE_CSHARP_SOURCE = `using System;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;
using Windows.Storage.Streams;

internal static class SheldonMediaProbe
{
    private static GlobalSystemMediaTransportControlsSessionManager _manager;
    private static string _lastThumbKey = "";
    private static string _lastThumbBase64 = "";

    private static T AwaitOp<T>(IAsyncOperation<T> op)
    {
        if (op == null) return default(T);
        if (op.Status == AsyncStatus.Started)
        {
            var mre = new ManualResetEventSlim(false);
            op.Completed = (sender, status) => mre.Set();
            mre.Wait(2500);
        }
        if (op.Status == AsyncStatus.Completed)
        {
            return op.GetResults();
        }
        return default(T);
    }

    private static void Main()
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        try
        {
            _manager = AwaitOp(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
        }
        catch
        {
            _manager = null;
        }

        string line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line == "EXIT") break;

            try
            {
                if (_manager == null)
                {
                    _manager = AwaitOp(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
                }

                if (line == "STATUS")
                {
                    Console.WriteLine(ReadStatusJson());
                }
                else if (line == "PLAY_PAUSE")
                {
                    var s = GetPreferredSession();
                    if (s != null) AwaitOp(s.TryTogglePlayPauseAsync());
                    Thread.Sleep(120);
                    Console.WriteLine(ReadStatusJson());
                }
                else if (line == "NEXT")
                {
                    var s = GetPreferredSession();
                    if (s != null) AwaitOp(s.TrySkipNextAsync());
                    Thread.Sleep(180);
                    Console.WriteLine(ReadStatusJson());
                }
                else if (line == "PREV")
                {
                    var s = GetPreferredSession();
                    if (s != null) AwaitOp(s.TrySkipPreviousAsync());
                    Thread.Sleep(180);
                    Console.WriteLine(ReadStatusJson());
                }
                else
                {
                    Console.WriteLine("{\\"available\\":false}");
                }
            }
            catch
            {
                Console.WriteLine("{\\"available\\":false}");
            }
        }
    }

    private static bool IsSpotifySession(GlobalSystemMediaTransportControlsSession s)
    {
        return s != null && !string.IsNullOrEmpty(s.SourceAppUserModelId) &&
               s.SourceAppUserModelId.IndexOf("spotify", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private static GlobalSystemMediaTransportControlsSession GetPreferredSession()
    {
        if (_manager == null) return null;
        var sessions = _manager.GetSessions();
        if (sessions != null)
        {
            GlobalSystemMediaTransportControlsSession spotifyFallback = null;
            GlobalSystemMediaTransportControlsSession anyPlaying = null;
            foreach (var s in sessions)
            {
                var pInfo = s.GetPlaybackInfo();
                bool isPlaying = pInfo != null &&
                    pInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
                bool isSpotify = IsSpotifySession(s);
                if (isSpotify && isPlaying) return s;
                if (isSpotify && spotifyFallback == null) spotifyFallback = s;
                if (isPlaying && anyPlaying == null) anyPlaying = s;
            }
            if (anyPlaying != null) return anyPlaying;
            if (spotifyFallback != null) return spotifyFallback;
        }
        return _manager.GetCurrentSession();
    }

    private static string ReadStatusJson()
    {
        var session = GetPreferredSession();
        if (session == null) return "{\\"available\\":false}";

        var info = session.GetPlaybackInfo();
        var props = AwaitOp(session.TryGetMediaPropertiesAsync());
        var tl = session.GetTimelineProperties();

        bool isPlaying = info != null &&
            info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
        string title = props != null ? (props.Title ?? "") : "";
        string artist = props != null ? (props.Artist ?? "") : "";
        string album = props != null ? (props.AlbumTitle ?? "") : "";
        string appId = session.SourceAppUserModelId ?? "";

        double startSec = tl != null ? Math.Max(0, tl.StartTime.TotalSeconds) : 0;
        double endSec = tl != null ? Math.Max(0, tl.EndTime.TotalSeconds) : 0;
        double rawPosSec = tl != null ? Math.Max(0, tl.Position.TotalSeconds) : 0;
        double durSec = Math.Max(0, endSec - startSec);
        double posSec = Math.Max(0, rawPosSec - startSec);
        if (durSec > 0 && posSec > durSec) posSec = durSec;

        string trackKey = title + "|" + artist + "|" + album + "|" + appId;
        bool thumbUnchanged = trackKey == _lastThumbKey && !string.IsNullOrEmpty(title);

        if (!thumbUnchanged)
        {
            _lastThumbKey = trackKey;
            _lastThumbBase64 = "";
            if (props != null && props.Thumbnail != null)
            {
                try
                {
                    using (var stream = AwaitOp(props.Thumbnail.OpenReadAsync()))
                    {
                        if (stream != null && stream.Size > 0 && stream.Size < 500000)
                        {
                            uint size = (uint)stream.Size;
                            using (var input = stream.GetInputStreamAt(0))
                            using (var reader = new DataReader(input))
                            {
                                AwaitOp(reader.LoadAsync(size));
                                byte[] bytes = new byte[size];
                                reader.ReadBytes(bytes);
                                _lastThumbBase64 = "data:image/png;base64," + Convert.ToBase64String(bytes);
                            }
                        }
                    }
                }
                catch { }
            }
        }

        return "{"
            + "\\"available\\":" + (string.IsNullOrEmpty(title) ? "false" : "true") + ","
            + "\\"isPlaying\\":" + (isPlaying ? "true" : "false") + ","
            + "\\"title\\":\\"" + Escape(title) + "\\","
            + "\\"artist\\":\\"" + Escape(artist) + "\\","
            + "\\"album\\":\\"" + Escape(album) + "\\","
            + "\\"appId\\":\\"" + Escape(appId) + "\\","
            + "\\"positionSeconds\\":" + ((int)Math.Round(posSec)) + ","
            + "\\"durationSeconds\\":" + ((int)Math.Round(durSec)) + ","
            + "\\"thumbUnchanged\\":" + (thumbUnchanged ? "true" : "false") + ","
            + "\\"thumbnail\\":\\"" + (thumbUnchanged ? "" : Escape(_lastThumbBase64)) + "\\""
            + "}";
    }

    private static string Escape(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
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

function emptyMediaState(): NowPlayingMedia {
  return {
    available: false,
    title: '',
    artist: '',
    album: '',
    sourceApp: '',
    isSpotify: false,
    status: 'stopped',
    positionSeconds: 0,
    durationSeconds: 0,
    thumbnailBase64: null,
    updatedAt: Date.now(),
  };
}

function formatSourceApp(appId: string): { label: string; isSpotify: boolean } {
  const lower = appId.toLowerCase();
  if (lower.includes('spotify')) return { label: 'Spotify', isSpotify: true };
  if (lower.includes('chrome')) return { label: 'Google Chrome', isSpotify: false };
  if (lower.includes('msedge')) return { label: 'Microsoft Edge', isSpotify: false };
  if (lower.includes('firefox')) return { label: 'Firefox', isSpotify: false };
  if (lower.includes('brave')) return { label: 'Brave', isSpotify: false };
  if (lower.includes('applemusic') || lower.includes('itunes')) {
    return { label: 'Apple Music', isSpotify: false };
  }
  if (lower.includes('vlc')) return { label: 'VLC Media Player', isSpotify: false };
  const clean = appId.split('!').pop()?.replace(/\.exe$/i, '') || appId;
  return { label: clean || 'Mídia do Sistema', isSpotify: false };
}

interface PendingCommand {
  command: string;
  resolve: (media: NowPlayingMedia) => void;
}

export class MediaProbe extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private current: NowPlayingMedia = emptyMediaState();
  private cachedThumbnail: string | null = null;
  private queue: PendingCommand[] = [];
  private activeCommand: PendingCommand | null = null;
  private stopped = false;
  private initializing = false;
  private exePath: string | null = null;

  public getCurrentMedia(): NowPlayingMedia {
    return this.current;
  }

  public async start(): Promise<void> {
    if (process.platform !== 'win32') return;
    if (this.initializing || this.child) return;
    this.stopped = false;
    this.initializing = true;

    try {
      const compiledExe = await this.ensureCompiledProbe();
      if (!compiledExe || this.stopped) return;
      this.exePath = compiledExe;
      this.spawnWorker();
      this.pollTimer = setInterval(() => {
        void this.pollStatus();
      }, 2000);
      void this.pollStatus();
    } catch (err) {
      console.warn('[MediaProbe] Initialization skipped:', err);
    } finally {
      this.initializing = false;
    }
  }

  public stop(): void {
    this.stopped = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.drainQueueWithEmpty();
    if (this.child) {
      try {
        this.child.stdin.write('EXIT\n');
      } catch {
        // ignore
      }
      try {
        this.child.kill();
      } catch {
        // ignore
      }
      this.child = null;
    }
  }

  public async control(action: 'play-pause' | 'next' | 'prev'): Promise<NowPlayingMedia> {
    if (process.platform !== 'win32' || this.stopped) {
      return this.current;
    }
    if (!this.child && this.exePath) {
      this.spawnWorker();
    }
    if (!this.child) {
      return this.current;
    }
    const cmdMap: Record<'play-pause' | 'next' | 'prev', string> = {
      'play-pause': 'PLAY_PAUSE',
      next: 'NEXT',
      prev: 'PREV',
    };
    const nextMedia = await this.enqueueCommand(cmdMap[action]);
    this.updateCurrentState(nextMedia);
    return this.current;
  }

  private async pollStatus(): Promise<void> {
    if (this.stopped) return;
    if (this.queue.length > 0 || this.activeCommand) return;
    if (!this.child && this.exePath) {
      this.spawnWorker();
    }
    if (!this.child) return;
    const nextMedia = await this.enqueueCommand('STATUS');
    this.updateCurrentState(nextMedia);
  }

  private updateCurrentState(next: NowPlayingMedia): void {
    const prev = this.current;
    this.current = next;
    const changed =
      prev.available !== next.available ||
      prev.title !== next.title ||
      prev.artist !== next.artist ||
      prev.status !== next.status ||
      prev.thumbnailBase64 !== next.thumbnailBase64 ||
      Math.abs(prev.positionSeconds - next.positionSeconds) >= 1 ||
      prev.durationSeconds !== next.durationSeconds;

    if (changed) {
      this.emit('updated', this.current);
    }
  }

  private spawnWorker(): void {
    if (!this.exePath || this.stopped) return;
    const proc = spawn(this.exePath, [], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = proc;

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on('line', (line) => {
      const parsed = this.parseWorkerLine(line);
      const pending = this.activeCommand;
      this.activeCommand = null;
      if (pending) {
        pending.resolve(parsed);
      }
      this.flushNextCommand();
    });

    proc.on('exit', () => {
      if (this.child === proc) {
        this.child = null;
      }
      this.drainQueueWithEmpty();
    });

    proc.on('error', () => {
      if (this.child === proc) {
        this.child = null;
      }
      this.drainQueueWithEmpty();
    });
  }

  private enqueueCommand(command: string): Promise<NowPlayingMedia> {
    return new Promise((resolve) => {
      this.queue.push({ command, resolve });
      this.flushNextCommand();
    });
  }

  private flushNextCommand(): void {
    if (this.activeCommand || this.queue.length === 0 || !this.child || this.stopped) return;
    const next = this.queue.shift()!;
    this.activeCommand = next;
    try {
      this.child.stdin.write(`${next.command}\n`);
    } catch {
      this.activeCommand = null;
      next.resolve(this.current);
      this.flushNextCommand();
    }
  }

  private drainQueueWithEmpty(): void {
    if (this.activeCommand) {
      this.activeCommand.resolve(this.current);
      this.activeCommand = null;
    }
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      item.resolve(this.current);
    }
  }

  private parseWorkerLine(line: string): NowPlayingMedia {
    try {
      const raw = JSON.parse(line.trim()) as {
        available?: boolean;
        isPlaying?: boolean;
        title?: string;
        artist?: string;
        album?: string;
        appId?: string;
        positionSeconds?: number;
        durationSeconds?: number;
        thumbUnchanged?: boolean;
        thumbnail?: string;
      };

      if (!raw.available || !raw.title) {
        this.cachedThumbnail = null;
        return emptyMediaState();
      }

      if (!raw.thumbUnchanged) {
        this.cachedThumbnail = raw.thumbnail && raw.thumbnail.length > 0 ? raw.thumbnail : null;
      }

      const source = formatSourceApp(raw.appId || '');
      return {
        available: true,
        title: raw.title || '',
        artist: raw.artist || '',
        album: raw.album || '',
        sourceApp: source.label,
        isSpotify: source.isSpotify,
        status: raw.isPlaying ? 'playing' : 'paused',
        positionSeconds: Math.max(0, Number(raw.positionSeconds) || 0),
        durationSeconds: Math.max(0, Number(raw.durationSeconds) || 0),
        thumbnailBase64: this.cachedThumbnail,
        updatedAt: Date.now(),
      };
    } catch {
      return this.current;
    }
  }

  private async ensureCompiledProbe(): Promise<string | null> {
    const binDir = path.join(app.getPath('userData'), 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const hash = crypto.createHash('sha1').update(PROBE_CSHARP_SOURCE).digest('hex').slice(0, 10);
    const csPath = path.join(binDir, 'SheldonMediaProbe.cs');
    const hashPath = path.join(binDir, 'SheldonMediaProbe.hash');
    const exePath = path.join(binDir, 'SheldonMediaProbe.exe');

    const existingHash = fs.existsSync(hashPath) ? fs.readFileSync(hashPath, 'utf-8').trim() : '';
    if (existingHash === hash && fs.existsSync(exePath)) {
      return exePath;
    }

    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
    const winRuntimeDll =
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Runtime.InteropServices.WindowsRuntime.dll';
    const systemRuntimeDll =
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Runtime.dll';
    const mediaWinmd = 'C:\\Windows\\System32\\WinMetadata\\Windows.Media.winmd';
    const foundationWinmd = 'C:\\Windows\\System32\\WinMetadata\\Windows.Foundation.winmd';
    const storageWinmd = 'C:\\Windows\\System32\\WinMetadata\\Windows.Storage.winmd';

    if (
      !fs.existsSync(cscPath) ||
      !fs.existsSync(mediaWinmd) ||
      !fs.existsSync(foundationWinmd) ||
      !fs.existsSync(storageWinmd)
    ) {
      return null;
    }

    fs.writeFileSync(csPath, PROBE_CSHARP_SOURCE, 'utf-8');

    const args = [
      '/nologo',
      '/optimize+',
      '/target:exe',
      `/out:${exePath}`,
      `/r:${systemRuntimeDll}`,
      `/r:${winRuntimeDll}`,
      `/r:${mediaWinmd}`,
      `/r:${foundationWinmd}`,
      `/r:${storageWinmd}`,
      csPath,
    ];

    const compiled = await new Promise<boolean>((resolve) => {
      execFile(cscPath, args, { windowsHide: true }, (err) => {
        if (err) {
          console.warn('[MediaProbe] csc compilation failed:', err.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });

    if (!compiled || !fs.existsSync(exePath)) {
      return null;
    }
    fs.writeFileSync(hashPath, hash, 'utf-8');
    return exePath;
  }
}
