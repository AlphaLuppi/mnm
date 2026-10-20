# Built-in sounds

Short notification sounds played per toast tone (info / success / warn / error).

Built-ins may be any **browser-supported audio format the app accepts** —
`.wav`, `.mp3`, `.ogg`, or `.webm` (same set as user uploads). Keep each file
small (< 200 KB); each must be registered in
[`ui/src/sounds/manifest.ts`](../../src/sounds/manifest.ts).

## Adding a sound

**Ready-made file (e.g. an MP3):** drop it here and register it in the manifest.
Mind the license — this repo is public/open-source; only commit audio you own or
that is CC0 / public-domain.

**Synthesized (the default `*.wav` here):** these are authored in-repo (additive
sine synthesis, so no third-party license) by
`scripts/sounds/generate-sounds.mjs`:

```bash
bun run sounds:generate        # or: node scripts/sounds/generate-sounds.mjs
```

Add/edit a voice in that script, regenerate, then register the file.

**Rendered with [earshot](https://github.com/Leonxlnx/earshot)** (`soft-pop`,
`glass-ping`, `bell-chime`, `rise-chime`, `double-ding`, `low-sweep`): rendered
by ID from earshot's sound bank — code-synthesized recipes (MIT), no recorded
audio — then trimmed/faded/peak-normalized to -3 dBFS with ffmpeg. Earshot's
`sfx check` audit flags them clean (no clicks, natural tails, unlike the sine
set above, whose tails are cut while still audible). Regenerate with:

```bash
pip install -e <earshot-clone>   # pinned commit in the script
python3 scripts/sounds/render-earshot-sounds.py --earshot <venv>/bin/earshot --clone <earshot-clone>
```

They're offered as extra choices; the default tone mapping still uses the sine
set until they've been validated by ear.

The default `*.wav` files are intentionally WAV: at sub-second durations they
stay tiny and play with no priming latency (unlike MP3), which suits a snappy UI
cue. The default tone→sound mapping lives in `DEFAULT_SOUND_SETTINGS`
(`@mnm/shared`).
