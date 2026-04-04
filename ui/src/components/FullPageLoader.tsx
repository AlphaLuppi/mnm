import { useEffect, useRef } from "react";

const LOGO_FULL = [
  "████              ████                ████              ████",
  "██ ███          ███ ██                ██ ███          ███ ██",
  "██  ███        ███  ██                ██  ███        ███  ██",
  "██   ███      ███   ██                ██   ███      ███   ██",
  "██    ███    ███    ██                ██    ███    ███    ██",
  "██     ███  ███     ██   ▄████████▄   ██     ███  ███     ██",
  "██      ██████      ██   ██      ██   ██      ██████      ██",
  "██       ████       ██   ██      ██   ██       ████       ██",
  "██        ██        ██   ██      ██   ██        ██        ██",
  "██                  ██   ██      ██   ██                  ██",
  "██                  ██   ██      ██   ██                  ██",
  "██                  ██ake██      ██o  ██                  ██istake",
];
const LOGO_COMPACT = [
  "██▄     ▄██            ██▄     ▄██",
  "████▄ ▄████            ████▄ ▄████",
  "██ ▀███▀ ██   ▄▀▀▀▀▄   ██ ▀███▀ ██",
  "██  ▀█▀  ██   █    █   ██  ▀█▀  ██",
  "██       ██   █    █   ██       ██",
  "██       ██   █    █   ██       ██",
  "▀▀       ▀▀ake▀    ▀o  ▀▀       ▀▀istake",
];
const FULL_W = Math.max(...LOGO_FULL.map(l => l.length));
const NOISE = "░▒▓█▀▄╔╗╚╝║═╭╮╰╯│─";
const GLYPH = [" ", ".", "·", "▪", "▫", "○"] as const;
const SPRITES = [
  ["  ╭────╮ ", " ╭╯╭──╮│ ", " │ │  ││ ", " │ │  ││ ", " │ ╰──╯│ ", " ╰─────╯ "],
  [" ╭─────╮ ", " │╭──╮╰╮ ", " ││  │ │ ", " ││  │ │ ", " │╰──╯ │ ", " ╰────╯  "],
];
const FPS = 24;
const FRAME_MS = 1000 / FPS;

function measureChar(container: HTMLElement) {
  const s = document.createElement("span");
  s.textContent = "M";
  s.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:11px/1 monospace";
  container.appendChild(s);
  const r = s.getBoundingClientRect();
  container.removeChild(s);
  return { w: r.width || 7, h: r.height || 11 };
}

interface Clip {
  x: number; y: number; vx: number; vy: number;
  sp: string[]; sw: number; sh: number;
  life: number; maxLife: number;
}

export function FullPageLoader() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!preRef.current) return;
    const pre: HTMLPreElement = preRef.current;

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let { w: cw, h: ch } = measureChar(pre);
    let cols = 0, rows = 0, lox = 0, loy = 0;
    let LOGO = LOGO_FULL;
    let LH = LOGO.length;
    let LW = Math.max(...LOGO.map(l => l.length));
    let logoMap = new Map<number, { ch: string }>();
    let clipMask = new Uint16Array(0);
    let clips: Clip[] = [];
    let tick = 0, lastFrame = 0;
    let loopActive = false;

    function resize() {
      const nc = Math.max(1, Math.floor(pre.clientWidth / cw));
      const nr = Math.max(1, Math.floor(pre.clientHeight / ch));
      if (nc === cols && nr === rows) return;
      cols = nc; rows = nr;

      LOGO = cols >= FULL_W + 6 ? LOGO_FULL : LOGO_COMPACT;
      LH = LOGO.length;
      LW = Math.max(...LOGO.map(l => l.length));

      lox = Math.floor((cols - LW) / 2);
      loy = Math.floor((rows - LH) / 2);
      clipMask = new Uint16Array(cols * rows);
      logoMap = new Map();
      for (let r = 0; r < LH; r++) {
        const line = LOGO[r]!;
        for (let c = 0; c < line.length; c++) {
          const char = line[c]!;
          if (char === " ") continue;
          const gr = loy + r, gc = lox + c;
          if (gr < 0 || gr >= rows || gc < 0 || gc >= cols) continue;
          logoMap.set(gr * cols + gc, { ch: char });
        }
      }
    }

    function spawnClip() {
      const sp = SPRITES[Math.floor(Math.random() * SPRITES.length)];
      const sh = sp.length, sw = Math.max(...sp.map(l => l.length));
      let x: number, y: number, vx: number, vy: number;
      if (Math.random() < 0.6) {
        x = Math.random() < 0.5 ? -sw - 1 : cols + 1;
        y = Math.random() * rows;
        vx = x < 0 ? 0.03 + Math.random() * 0.04 : -(0.03 + Math.random() * 0.04);
        vy = (Math.random() - 0.5) * 0.01;
      } else {
        x = Math.random() * cols; y = Math.random() < 0.5 ? -sh - 1 : rows + 1;
        vx = (Math.random() - 0.5) * 0.01;
        vy = y < 0 ? 0.02 + Math.random() * 0.03 : -(0.02 + Math.random() * 0.03);
      }
      clips.push({ x, y, vx, vy, sp, sw, sh, life: 0, maxLife: 280 + Math.random() * 200 });
    }

    function drawStatic() {
      let out = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lc = logoMap.get(r * cols + c);
          if (lc) { out += lc.ch; }
          else {
            const v = (Math.sin(c * 0.11 + r * 0.04) + Math.cos(r * 0.08 - c * 0.02)) * 0.18 + 0.22;
            out += GLYPH[Math.floor(Math.max(0, Math.min(0.999, v)) * GLYPH.length)];
          }
        }
        if (r < rows - 1) out += "\n";
      }
      pre.textContent = out;
    }

    function step(time: number) {
      if (!loopActive) return;
      frameRef.current = requestAnimationFrame(step);
      if (time - lastFrame < FRAME_MS || cols <= 0 || rows <= 0) return;

      const dt = lastFrame ? Math.min(3, (time - lastFrame) / 16.667) : 1;
      lastFrame = time; tick += dt;

      const targetClips = Math.max(2, Math.floor((cols * rows) / 3000));
      while (clips.length < targetClips) spawnClip();

      clipMask.fill(0);
      for (let i = clips.length - 1; i >= 0; i--) {
        const cl = clips[i]!;
        cl.life += dt;
        cl.vx = (cl.vx + Math.sin((cl.y + tick * 0.12) * 0.09) * 0.0015) * 0.998;
        cl.vy = (cl.vy + Math.cos((cl.x - tick * 0.09) * 0.08) * 0.0012) * 0.998;
        cl.x += cl.vx * dt; cl.y += cl.vy * dt;
        if (cl.life >= cl.maxLife || cl.x < -cl.sw - 2 || cl.x > cols + 2 || cl.y < -cl.sh - 2 || cl.y > rows + 2) {
          clips.splice(i, 1); continue;
        }
        const t = cl.life / cl.maxLife;
        const alpha = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1;
        if (alpha < 0.3) continue;
        const bR = Math.round(cl.y), bC = Math.round(cl.x);
        for (let sr = 0; sr < cl.sp.length; sr++) {
          const line = cl.sp[sr]!;
          const row = bR + sr;
          if (row < 0 || row >= rows) continue;
          for (let sc = 0; sc < line.length; sc++) {
            const c = line[sc]; if (c === " ") continue;
            const col = bC + sc;
            if (col < 0 || col >= cols) continue;
            if (row >= loy - 2 && row < loy + LH + 2 && col >= lox - 3 && col < lox + LW + 3) continue;
            clipMask[row * cols + col] = c!.charCodeAt(0);
          }
        }
      }

      const colW = new Float32Array(cols), rowW = new Float32Array(rows);
      for (let c = 0; c < cols; c++) colW[c] = Math.sin(c * 0.08 + tick * 0.06);
      for (let r = 0; r < rows; r++) rowW[r] = Math.cos(r * 0.1 - tick * 0.05);

      let out = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const lc = logoMap.get(idx);
          if (lc) {
            out += Math.random() < 0.002 ? NOISE[Math.floor(Math.random() * NOISE.length)] : lc.ch;
          } else if (clipMask[idx] > 0) {
            out += String.fromCharCode(clipMask[idx]);
          } else {
            const v = (colW[c]! + rowW[r]!) * 0.08 + 0.1;
            out += GLYPH[Math.floor(Math.max(0, Math.min(0.999, v * 0.5)) * GLYPH.length)];
          }
        }
        if (r < rows - 1) out += "\n";
      }
      pre.textContent = out;
    }

    function syncLoop() {
      if (motionMedia.matches || cols <= 0 || rows <= 0) {
        if (loopActive) {
          loopActive = false;
          if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        if (cols > 0 && rows > 0) drawStatic();
        return;
      }
      if (!loopActive) {
        loopActive = true; lastFrame = 0;
        frameRef.current = requestAnimationFrame(step);
      }
    }

    const observer = new ResizeObserver(() => {
      const m = measureChar(pre);
      cw = m.w; ch = m.h;
      resize(); syncLoop();
    });
    observer.observe(pre);

    const onMotion = () => syncLoop();
    motionMedia.addEventListener("change", onMotion);

    resize(); syncLoop();

    return () => {
      loopActive = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
      motionMedia.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <pre
        ref={preRef}
        className="w-full h-full m-0 p-0 overflow-hidden text-muted-foreground/60 select-none leading-none"
        style={{ fontSize: "11px", fontFamily: "monospace" }}
        aria-hidden="true"
      />
    </div>
  );
}
