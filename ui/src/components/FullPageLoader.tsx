import { useEffect, useRef } from "react";

const LOGO = [
  "███╗   ███╗       █████╗       ███╗   ███╗",
  "████╗ ████║      ██╔══██╗      ████╗ ████║",
  "██╔████╔██║      ██║  ██║      ██╔████╔██║",
  "██║╚██╔╝██║      ██║  ██║      ██║╚██╔╝██║",
  "██║ ╚═╝ ██║      ██║  ██║      ██║ ╚═╝ ██║",
  "╚═╝     ╚═╝ake   ╚═╝  ╚═╝o     ╚═╝     ╚═╝istake",
];
const NOISE = "░▒▓█▀▄╔╗╚╝║═╭╮╰╯│─";
const GLYPH = [" ", ".", "·", "▪", "▫", "○"] as const;
const FPS = 24;
const FRAME_MS = 1000 / FPS;
const LH = LOGO.length;
const LW = Math.max(...LOGO.map(l => l.length));

function measureChar(container: HTMLElement) {
  const s = document.createElement("span");
  s.textContent = "M";
  s.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit";
  container.appendChild(s);
  const r = s.getBoundingClientRect();
  container.removeChild(s);
  return { w: r.width || 7, h: r.height || 11 };
}

export function FullPageLoader({ inline }: { inline?: boolean } = {}) {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!preRef.current) return;
    const pre: HTMLPreElement = preRef.current;

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    let { w: cw, h: ch } = measureChar(pre);
    let cols = 0, rows = 0, lox = 0, loy = 0;
    let logoMap = new Map<number, { ch: string }>();
    let tick = 0, lastFrame = 0;
    let loopActive = false;

    function resize() {
      const nc = Math.max(1, Math.floor(pre.clientWidth / cw));
      const nr = Math.max(1, Math.floor(pre.clientHeight / ch));
      if (nc === cols && nr === rows) return;
      cols = nc; rows = nr;
      lox = Math.floor((cols - LW) / 2);
      loy = Math.floor((rows - LH) / 2);
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

  const baseClass = "w-full h-full m-0 p-0 overflow-hidden select-none leading-none text-stone-600 dark:text-stone-400 font-mono text-[11px]";

  if (inline) {
    return (
      <pre
        ref={preRef}
        className={`${baseClass} md:text-[20px]`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <pre
        ref={preRef}
        className={`${baseClass} md:text-[30px]`}
        aria-hidden="true"
      />
    </div>
  );
}
