/**
 * Moving a bundle across as pictures.
 *
 * One QR code holds a couple of kilobytes at a size a phone camera can actually
 * read, so anything bigger goes as a loop of frames the sender cycles and the
 * receiver collects. There is no back-channel - the screen cannot know what the
 * camera has caught - so the sender simply keeps looping and the receiver keeps
 * watching until it has every piece. Missing one costs a lap, not the transfer.
 *
 * This is the transport for a room with no Bluetooth, no AirDrop and no network
 * of any kind. It carries text well and pictures badly, which is why a bundle
 * sent this way leaves its media behind.
 */
import qrcode from "qrcode-generator";

/** Frame header: L1/<sequence>/<total>/ then the payload. */
const HEADER = /^L1\/(\d{1,4})\/(\d{1,4})\/([\s\S]*)$/;

/**
 * Payload budget per frame.
 *
 * A version-40 code holds far more, but only a still camera and a big screen
 * ever read one. This sits around version 20-25, which a phone locks onto in a
 * single pass at arm's length.
 */
const CHUNK_BYTES = 700;

/** Frames per second the sender advances through the loop. */
export const FRAME_MS = 260;

/** Beyond this the loop is long enough that handing over a file is kinder. */
export const QR_MAX_BYTES = 60 * 1024;

export interface QrFrame {
  seq: number;
  total: number;
  /** Module matrix, true where the cell is dark. */
  cells: boolean[][];
}

/**
 * Splits packed bundle bytes into frames.
 *
 * The bytes are base64'd first. That costs a third in size but buys a payload
 * every QR encoder handles identically, which matters more than density when
 * the reader is somebody else's phone.
 */
export function toFrames(bytes: Uint8Array): QrFrame[] {
  const text = bytesToBase64(bytes);
  const total = Math.max(1, Math.ceil(text.length / CHUNK_BYTES));
  const frames: QrFrame[] = [];

  for (let seq = 0; seq < total; seq++) {
    const payload = text.slice(seq * CHUNK_BYTES, (seq + 1) * CHUNK_BYTES);
    frames.push({ seq, total, cells: encode(`L1/${seq}/${total}/${payload}`) });
  }
  return frames;
}

/** Collects frames as the camera finds them, in any order, with repeats. */
export class FrameCollector {
  private parts = new Map<number, string>();
  private total = 0;

  /** True when this scan was a piece we did not already have. */
  accept(raw: string): boolean {
    const match = raw.match(HEADER);
    if (!match) return false;

    const seq = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isInteger(seq) || !Number.isInteger(total) || total < 1) return false;

    // A frame from a different bundle would corrupt this one silently.
    if (this.total && total !== this.total) return false;
    this.total = total;

    if (this.parts.has(seq)) return false;
    this.parts.set(seq, match[3]);
    return true;
  }

  get received(): number {
    return this.parts.size;
  }

  get expected(): number {
    return this.total;
  }

  get complete(): boolean {
    return this.total > 0 && this.parts.size === this.total;
  }

  /** Which pieces are still missing, so the reader knows to keep watching. */
  get missing(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.total; i++) if (!this.parts.has(i)) out.push(i);
    return out;
  }

  assemble(): Uint8Array {
    if (!this.complete) throw new Error("The transfer is not finished yet.");
    let text = "";
    for (let i = 0; i < this.total; i++) text += this.parts.get(i) ?? "";
    return base64ToBytes(text);
  }

  reset() {
    this.parts.clear();
    this.total = 0;
  }
}

/* -------------------------------------------------------------------------- */

function encode(text: string): boolean[][] {
  // Version 0 lets the library pick the smallest that fits; L keeps the module
  // count down, and a screen held still does not need much error correction.
  const qr = qrcode(0, "L");
  qr.addData(text, "Byte");
  qr.make();

  const size = qr.getModuleCount();
  const cells: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) line.push(qr.isDark(row, col));
    cells.push(line);
  }
  return cells;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked: spreading a large array into String.fromCharCode blows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
