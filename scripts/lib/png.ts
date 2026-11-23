import { deflateSync } from 'node:zlib';

export type ImageSpec = { headline: string; bg: string; fg: string; style: string };
const W = 1280;
const H = 720;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array): Buffer => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

/** 5x7 glyphs, rows separated by '/', '#' = on. Unknown characters render blank. */
const G: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####', J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####', '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.', '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '.###./#..../#..../####./#...#/#...#/.###.', '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.', '9': '.###./#...#/#...#/.####/....#/....#/.###.',
  '.': '...../...../...../...../...../.##../.##..', ',': '...../...../...../...../.##../..#../.#...',
  '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..',
  '-': '...../...../...../#####/...../...../.....', ':': '...../.##../.##../...../.##../.##../.....',
  "'": '.##../..#../.#.../...../...../...../.....', $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##', '&': '.##../#..#./.##../.#.#./#..#./#..#./.##.#',
  '+': '...../..#../..#../#####/..#../..#../.....', '/': '....#/....#/...#./..#../.#.../#..../#....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.', ')': '.#.../..#../...#./...#./...#./..#../.#...',
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const renderPng = (spec: ImageSpec): Buffer => {
  const px = Buffer.alloc(W * H * 3);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: Rgb) => {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const o = (y * W + x) * 3;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
      }
  };
  const bg = rgb(spec.bg);
  const fg = rgb(spec.fg);
  rect(0, 0, W, H, bg);

  const box = { x0: 80, x1: W - 80 };
  if (spec.style === 'bold') rect(0, 0, W, 56, fg);
  if (spec.style === 'minimal') rect(80, 84, W - 80, 90, fg);
  if (spec.style === 'split') rect(W / 2, 0, W, H, bg.map((v) => Math.round(v * 0.75)) as Rgb);
  if (spec.style === 'face') {
    const cx = 1010, cy = 360, r = 190;
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) rect(x, y, x + 1, y + 1, fg);
    rect(cx - 90, cy - 60, cx - 50, cy - 20, bg);
    rect(cx + 50, cy - 60, cx + 90, cy - 20, bg);
    rect(cx - 70, cy + 70, cx + 70, cy + 90, bg);
    box.x1 = 760;
  }

  // Largest scale whose word-wrapped lines fit (glyph advance = 6 cells, line height = 9 cells).
  const words = spec.headline.toUpperCase().split(/\s+/).filter(Boolean);
  const wrap = (scale: number): string[] => {
    const maxChars = Math.floor((box.x1 - box.x0) / (6 * scale));
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (!cur || next.length <= maxChars) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  let scale = 14;
  let lines = wrap(scale);
  while (scale > 3 && (lines.length * 9 * scale > H - 240 || lines.some((l) => l.length * 6 * scale > box.x1 - box.x0))) {
    scale--;
    lines = wrap(scale);
  }
  let y = Math.round((H - lines.length * 9 * scale) / 2) + (spec.style === 'bold' ? 20 : 0);
  for (const line of lines) {
    let x = box.x0;
    for (const ch of line) {
      (G[ch] ?? '').split('/').forEach((row, ry) =>
        [...row].forEach((cell, rx) => {
          if (cell === '#') rect(x + rx * scale, y + ry * scale, x + (rx + 1) * scale, y + (ry + 1) * scale, fg);
        }),
      );
      x += 6 * scale;
    }
    y += 9 * scale;
  }

  const stride = W * 3 + 1;
  const raw = Buffer.alloc(stride * H); // each row starts with filter byte 0
  for (let r = 0; r < H; r++) px.copy(raw, r * stride + 1, r * W * 3, (r + 1) * W * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
