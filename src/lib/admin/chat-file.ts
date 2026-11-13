/**
 * chat-file.ts: the text of a WhatsApp chat export. Android saves a .txt;
 * an iPhone saves a .zip with _chat.txt inside, read here without a zip
 * library, using the browser's own decompression. Nothing is uploaded.
 */

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

const isZip = (b: Uint8Array) =>
  b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;

/** The chat's text, from a .txt or from the .txt inside a .zip. */
export async function chatText(bytes: Uint8Array): Promise<string> {
  if (!isZip(bytes)) return new TextDecoder().decode(bytes);
  const entry = await txtFromZip(bytes);
  if (entry == null) throw new Error('No chat text in that zip.');
  return entry;
}

async function txtFromZip(bytes: Uint8Array): Promise<string | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record sits in the last 22 bytes, plus up to 64 KB of comment.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === END) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);

  const names = new TextDecoder();
  let pick: { method: number; size: number; offset: number } | null = null;
  for (let n = 0; n < count && view.getUint32(at, true) === CENTRAL; n++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const base = name.split('/').pop() ?? name;
    // WhatsApp names it _chat.txt; any other .txt is a fallback.
    if (
      base === '_chat.txt' ||
      (!pick && base.toLowerCase().endsWith('.txt'))
    ) {
      pick = { method, size, offset };
      if (base === '_chat.txt') break;
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  if (!pick || view.getUint32(pick.offset, true) !== LOCAL) return null;

  const start =
    pick.offset +
    30 +
    view.getUint16(pick.offset + 26, true) +
    view.getUint16(pick.offset + 28, true);
  const data = bytes.subarray(start, start + pick.size);
  if (pick.method === 0) return new TextDecoder().decode(data);
  if (pick.method !== 8) return null;
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
