#!/usr/bin/env python3
"""Regenerate MnM's earshot-based built-in sounds (ui/public/sounds/) from earshot's sound bank.

earshot: https://github.com/Leonxlnx/earshot (MIT) -- pinned commit below.
Sounds are rendered by bank ID (pure DSP, no model, no network, no recorded audio),
mixed/sequenced with ffmpeg, then post-processed: 3 ms fade-in, tail fade-out,
peak-normalised to -3 dBFS, WAV 16-bit mono 44.1 kHz.

Usage:  python3 render-earshot-sounds.py --earshot /path/to/venv/bin/earshot \
            [--clone /path/to/earshot-clone] [--out ./out] [--only id ...]
Requires: earshot installed (pip install -e <clone>), ffmpeg on PATH.
"""
import argparse, os, re, subprocess, sys, tempfile

EARSHOT_COMMIT = "925ebe56a1b755e5d354ab642bb8f344440cfa9c"  # git -C <clone> rev-parse HEAD

# id -> (description, [(earshot bank id, {cli flags}, offset_s, gain_db)], max_dur_s, fade_out_s)
SOUNDS = {
    "soft-pop": ("info: round bubble pop", [("pop/1", {}, 0.0, 0)], 0.6, 0.04),
    "glass-ping": ("info/general: short glassy ding", [("pro_notify/ding_2296", {}, 0.0, 0)], 0.6, 0.04),
    "bell-chime": ("neutral chime: struck bell G5", [("notify/m2", {"pitch": "G5"}, 0.0, 0)], 0.55, 0.28),
    "rise-chime": ("success: rising C6-G6-C7 ding arpeggio",
                   [("pro_notify/ding_1930", {"pitch": "C6"}, 0.00, -3.0),
                    ("pro_notify/ding_1930", {"pitch": "G6"}, 0.09, -1.5),
                    ("pro_notify/ding_1930", {"pitch": "C7"}, 0.18, 0.0)], 0.6, 0.04),
    "double-ding": ("warn: two identical Bb5 dings",
                    [("pro_notify/ding_1822", {"pitch": "Bb5"}, 0.00, 0),
                     ("pro_notify/ding_1822", {"pitch": "Bb5"}, 0.17, 0)], 0.6, 0.04),
    "low-sweep": ("error: warm downward sweep", [("pro_zip/down_warm", {}, 0.0, 0)], 0.6, 0.04),
}

def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)

def build(earshot, name, segs, maxdur, fade, outdir, tmp):
    ins, filt, labels = [], [], []
    for i, (sid, flags, off, gain) in enumerate(segs):
        p = os.path.join(tmp, f"{name}_{i}.wav")
        cmd = [earshot, "sfx", "render", sid, "-o", p, "--sr", "44100", "--peak", "-3"]
        for k, v in flags.items():
            cmd += [f"--{k}", str(v)]
        run(cmd)
        ins += ["-i", p]
        filt.append(f"[{i}:a]aformat=sample_fmts=fltp:channel_layouts=mono,volume={gain}dB,"
                    f"adelay={int(round(off*1000))}:all=1[a{i}]")
        labels.append(f"[a{i}]")
    mix = labels[0] + "anull," if len(segs) == 1 else \
        "".join(labels) + f"amix=inputs={len(segs)}:normalize=0:duration=longest,"
    chain = ";".join(filt) + ";" + mix + (
        f"atrim=0:{maxdur},afade=t=in:d=0.003,afade=t=out:st={maxdur-fade}:d={fade}:curve=qsin[m]")
    mixwav = os.path.join(tmp, f"{name}_mix.wav")
    run(["ffmpeg", "-y", *ins, "-filter_complex", chain, "-map", "[m]", "-ar", "44100", "-ac", "1",
         "-c:a", "pcm_f32le", mixwav])
    r = subprocess.run(["ffmpeg", "-i", mixwav, "-af", "volumedetect", "-f", "null", "-"],
                       capture_output=True, text=True)
    mx = float(re.search(r"max_volume: (-?[\d.]+) dB", r.stderr).group(1))
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{name}.wav")
    run(["ffmpeg", "-y", "-i", mixwav, "-af", f"volume={-3.0-mx:.3f}dB,alimiter=limit=0.7079:level=0",
         "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", out])
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--earshot", default="earshot")
    ap.add_argument("--clone", help="earshot git clone, to verify the pinned commit")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                  "..", "..", "ui", "public", "sounds"))
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    if a.clone:
        head = run(["git", "-C", a.clone, "rev-parse", "HEAD"]).stdout.strip()
        if head != EARSHOT_COMMIT:
            sys.exit(f"earshot clone at {head}, expected {EARSHOT_COMMIT}: output may differ")
    with tempfile.TemporaryDirectory() as tmp:
        for name, (desc, segs, md, fade) in SOUNDS.items():
            if a.only and name not in a.only:
                continue
            print(name, "->", build(a.earshot, name, segs, md, fade, a.out, tmp), f"({desc})")

if __name__ == "__main__":
    main()
