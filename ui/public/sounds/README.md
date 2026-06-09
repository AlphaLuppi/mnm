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

The default `*.wav` files are intentionally WAV: at sub-second durations they
stay tiny and play with no priming latency (unlike MP3), which suits a snappy UI
cue. The default tone→sound mapping lives in `DEFAULT_SOUND_SETTINGS`
(`@mnm/shared`).
