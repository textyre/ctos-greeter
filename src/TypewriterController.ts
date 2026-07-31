import type { SystemInfo } from './types/global';
import { TIMINGS } from './config/timings';
import { SELECTORS, CSS_CLASSES } from './config/selectors';
import { LOG_TEMPLATES } from './config/messages';
import { delay } from './utils/delay';
import { Formatter } from './utils/Formatter';
import { TypewriterEngine } from './components/TypewriterEngine';
import { FingerprintBarcode } from './components/barcode/FingerprintBarcode';
import { DOMAdapter } from './adapters/dom.adapter';

interface TextLine {
  type: 'text';
  text: string;
  divider?: boolean;
  id?: 'x11-display';
}

interface FingerprintLine {
  type: 'fingerprint';
  prefix: string;
  fingerprint: string;
}

type LogLine = TextLine | FingerprintLine;

/**
 * Orchestrates the terminal log typewriter sequence.
 * Generates log lines from system info and renders them one by one
 * using the appropriate renderer for each line type.
 */
export class TypewriterController {
  private readonly adapter = new DOMAdapter();
  private displayLineEl: HTMLElement | null = null;
  private resizeFrame: number | null = null;

  constructor(
    private readonly info: SystemInfo,
    private readonly username: string,
  ) {}

  async run(): Promise<void> {
    const container = this.adapter.queryElement(SELECTORS.TERMINAL_LOG, HTMLElement);
    if (!container) return;

    const lines = this.generateLogLines();

    for (const line of lines) {
      await this.renderLine(container, line);
      await delay(TIMINGS.TYPEWRITER.LINE_PAUSE);
    }
  }

  private generateLogLines(): LogLine[] {
    const region = Formatter.region(this.info.timezone, this.info.region_prefix);
    const machineUuid = Formatter.machineId(this.info.machine_id);
    const protocol = Formatter.protocol(this.info.virtualization_type);

    return [
      {
        type: 'text',
        text: LOG_TEMPLATES.REGION_LINK(region),
      },
      {
        type: 'text',
        text: LOG_TEMPLATES.SYSTEMD_JOURNAL(this.info.systemd_version, machineUuid),
      },
      {
        type: 'text',
        id: 'x11-display',
        text: this.getDisplayLineText(),
      },
      {
        type: 'text',
        text: LOG_TEMPLATES.DIVIDER,
        divider: true,
      },
      {
        type: 'text',
        text: LOG_TEMPLATES.BLUME_PROTOCOL(protocol),
      },
      {
        type: 'fingerprint',
        prefix: LOG_TEMPLATES.SENTINEL_PREFIX,
        fingerprint: this.info.ssh_fingerprint,
      },
      {
        type: 'text',
        text: LOG_TEMPLATES.BLUME_SESSION(this.username),
      },
    ];
  }

  private async renderLine(container: HTMLElement, line: LogLine): Promise<void> {
    const renderer = this.renderers[line.type];
    if (renderer) await renderer(container, line);
  }

  private renderers: Record<string, (container: HTMLElement, line: LogLine) => Promise<void>> = {
    text: this.renderText.bind(this),
    fingerprint: this.renderFingerprint.bind(this),
  };

  private async renderText(container: HTMLElement, line: LogLine): Promise<void> {
    if (line.type !== 'text') return;
    const lineEl = this.adapter.createElement('div');
    lineEl.className = line.divider
      ? CSS_CLASSES.LOG_LINE + ' ' + CSS_CLASSES.LOG_DIVIDER
      : CSS_CLASSES.LOG_LINE;
    container.appendChild(lineEl);
    await new TypewriterEngine(lineEl, line.text).type();

    if (line.id === 'x11-display') {
      this.displayLineEl = lineEl;
      this.bindDisplayResizeUpdates();
      this.updateDisplayLine();
    }
  }

  private async renderFingerprint(container: HTMLElement, line: LogLine): Promise<void> {
    if (line.type !== 'fingerprint') return;
    const lineEl = this.adapter.createElement('div');
    lineEl.className = CSS_CLASSES.LOG_LINE + ' ' + CSS_CLASSES.LOG_FINGERPRINT;
    container.appendChild(lineEl);

    // Type prefix using the shared typewriter engine
    await new TypewriterEngine(lineEl, line.prefix).type();

    // Insert barcode, fade in, then scramble
    const fp = new FingerprintBarcode(line.fingerprint);
    lineEl.appendChild(fp.container);
    requestAnimationFrame(() => fp.container.classList.add(CSS_CLASSES.VISIBLE));
    await fp.scramble();
  }

  private bindDisplayResizeUpdates(): void {
    window.addEventListener('resize', () => {
      if (this.resizeFrame !== null) {
        window.cancelAnimationFrame(this.resizeFrame);
      }

      this.resizeFrame = window.requestAnimationFrame(() => {
        this.resizeFrame = null;
        this.updateDisplayLine();
      });
    });
  }

  private updateDisplayLine(): void {
    if (!this.displayLineEl) return;
    this.displayLineEl.textContent = this.getDisplayLineText();
  }

  private getDisplayLineText(): string {
    return LOG_TEMPLATES.X11_DISPLAY(
      this.info.display_output,
      this.getCurrentDisplayResolution(),
    );
  }

  private getCurrentDisplayResolution(): string {
    const width = window.innerWidth || document.documentElement.clientWidth;
    const height = window.innerHeight || document.documentElement.clientHeight;

    if (width > 0 && height > 0) {
      return `${Math.round(width)}x${Math.round(height)}`;
    }

    return this.info.display_resolution;
  }
}
