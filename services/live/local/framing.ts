/**
 * Codec PURO del cable: mensajes JSON, uno por línea (`\n`).
 *
 * TCP es un chorro de bytes: un mensaje puede llegar partido en varios trozos
 * y varios mensajes pueden llegar en uno. `LineDecoder` guarda lo que falta y
 * entrega solo líneas completas. Lo que no es JSON válido o no tiene forma de
 * mensaje se cuenta como «basura» y se ignora (nunca lanza).
 */
import type { LiveEvent, LiveState } from '@/services/live/protocol';
import type { ControlMsg, WireMessage } from '@/services/live/local/wire';

/** Límite de una línea (caracteres). Una canción con ChordPro cabe de sobra. */
export const MAX_LINE_CHARS = 512 * 1024;

/** Serializa un mensaje a una línea terminada en `\n`. */
export function encodeLine(msg: WireMessage): string {
  return `${JSON.stringify(msg)}\n`;
}

const OPS = new Set<ControlMsg['op']>([
  'hello',
  'welcome',
  'ping',
  'pong',
  'command',
  'ack',
  'error',
  'catalog-offer',
  'catalog-request',
  'catalog-chunk',
  'catalog-done',
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isLiveState(v: unknown): v is LiveState {
  return (
    isObj(v) &&
    typeof v.sessionId === 'string' &&
    typeof v.seq === 'number' &&
    typeof v.at === 'number'
  );
}

function isLiveEvent(v: unknown): v is LiveEvent {
  return (
    isObj(v) &&
    (v.t === 'aviso' ||
      v.t === 'reaccion' ||
      v.t === 'fin' ||
      (v.t === 'apunte' && typeof v.id === 'string' && isObj(v.apunte))) &&
    typeof v.at === 'number'
  );
}

function isLiveMessage(v: unknown): boolean {
  if (!isObj(v)) return false;
  if (v.type === 'state') return isLiveState(v.state);
  if (v.type === 'event') return isLiveEvent(v.event);
  return false;
}

/**
 * Valida la FORMA de un objeto ya parseado (no su contenido: eso lo decide
 * quien lo recibe). Devuelve `null` si no es un mensaje del cable.
 */
export function parseWire(raw: unknown): WireMessage | null {
  if (!isObj(raw)) return null;
  if (raw.type === 'state' || raw.type === 'event') {
    return isLiveMessage(raw) ? (raw as unknown as WireMessage) : null;
  }
  const op = raw.op;
  if (typeof op !== 'string' || !OPS.has(op as ControlMsg['op'])) return null;
  switch (op) {
    case 'hello':
      if (typeof raw.deviceId !== 'string' || !raw.deviceId) return null;
      if (raw.role !== 'follower' && raw.role !== 'master') return null;
      if (typeof raw.catalogUpdatedAt !== 'number') return null;
      break;
    case 'welcome':
      if (typeof raw.serverId !== 'string') return null;
      if (raw.state != null && !isLiveState(raw.state)) return null;
      break;
    case 'ping':
    case 'pong':
      if (typeof raw.at !== 'number') return null;
      break;
    case 'command':
      if (!isLiveMessage(raw.msg)) return null;
      break;
    case 'error':
      if (typeof raw.code !== 'string') return null;
      break;
    case 'catalog-offer':
      if (
        typeof raw.updatedAt !== 'number' ||
        typeof raw.sha256 !== 'string' ||
        typeof raw.chunks !== 'number' ||
        typeof raw.bytes !== 'number'
      ) {
        return null;
      }
      break;
    case 'catalog-request':
      if (
        typeof raw.updatedAt !== 'number' ||
        typeof raw.from !== 'number' ||
        typeof raw.count !== 'number'
      ) {
        return null;
      }
      break;
    case 'catalog-chunk':
      if (
        typeof raw.updatedAt !== 'number' ||
        typeof raw.i !== 'number' ||
        typeof raw.n !== 'number' ||
        typeof raw.data !== 'string'
      ) {
        return null;
      }
      break;
    case 'catalog-done':
      if (typeof raw.updatedAt !== 'number') return null;
      break;
    default:
      break;
  }
  return raw as unknown as WireMessage;
}

export interface DecodeResult {
  messages: WireMessage[];
  /** Líneas que no eran un mensaje (JSON roto, forma desconocida). */
  garbage: number;
  /** Se pasó del límite de línea (se descarta hasta el siguiente `\n`). */
  overflow: boolean;
}

/** Decodificador con memoria: `push` cada trozo que llegue del socket. */
export class LineDecoder {
  private buf = '';
  /** Estamos tirando una línea demasiado larga hasta su `\n`. */
  private discarding = false;

  constructor(private readonly maxLine = MAX_LINE_CHARS) {}

  push(chunk: string): DecodeResult {
    const out: DecodeResult = { messages: [], garbage: 0, overflow: false };
    let rest = chunk;
    while (rest.length > 0) {
      const nl = rest.indexOf('\n');
      if (nl < 0) {
        if (this.discarding) return out;
        this.buf += rest;
        if (this.buf.length > this.maxLine) {
          this.buf = '';
          this.discarding = true;
          out.overflow = true;
        }
        return out;
      }
      const head = rest.slice(0, nl);
      rest = rest.slice(nl + 1);
      if (this.discarding) {
        // Termina la línea larga descartada.
        this.discarding = false;
        continue;
      }
      const line = this.buf + head;
      this.buf = '';
      if (line.length > this.maxLine) {
        out.overflow = true;
        continue;
      }
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: WireMessage | null = null;
      try {
        parsed = parseWire(JSON.parse(trimmed));
      } catch {
        parsed = null;
      }
      if (parsed) out.messages.push(parsed);
      else out.garbage += 1;
    }
    return out;
  }

  /** Lo que queda sin terminar (para tests y diagnóstico). */
  get pending(): number {
    return this.buf.length;
  }

  reset(): void {
    this.buf = '';
    this.discarding = false;
  }
}
