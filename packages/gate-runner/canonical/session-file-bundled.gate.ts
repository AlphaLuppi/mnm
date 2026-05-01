/**
 * Canonical gate: session-file-bundled
 *
 * Exit gate qui vérifie qu'un step gouverné a bundlé son fichier de session
 * (Claude Code .jsonl V1) dans `artifact.data.session_file`. Activée opt-in
 * dans le `workflow.json` du step (`gates.exit: [{ name: "session-file-bundled" }]`).
 *
 * Forme acceptée pour `artifact.data.session_file` :
 *   - string                                       (JSONL brut, défaut)
 *   - { encoding: "raw",          content: string } (JSONL brut, explicite)
 *   - { encoding: "gzip-base64",  content: string } (compressé, NON parsé ici)
 *
 * Limitations isolated-vm : la gate n'a PAS accès à zlib/Buffer/atob. Donc :
 *   - cas "raw" / string    → la gate parse chaque ligne comme JSON
 *   - cas "gzip-base64"     → la gate vérifie présence + taille uniquement.
 *                              Le parsing complet est fait par finalizeClientRun
 *                              (Task 6) côté serveur avec accès Node/zlib.
 *
 * Config :
 *   - min_messages (int, défaut 1)   : nombre minimal d'entrées JSONL.
 *                                      Ignoré si encoding=gzip-base64.
 *   - max_size_mb  (int, défaut 150) : cap sur la longueur du contenu (raw
 *                                      ou base64). 150MB ≈ 100MB binaire post-
 *                                      décompression (base64 = ~133% binary).
 *                                      Le cap décompressé final est appliqué
 *                                      côté serveur.
 *
 * Error codes :
 *   - GATE_INVALID_CONFIG               — config malformée (min_messages négatif,
 *                                          encoding inconnu, etc.).
 *   - SESSION_FILE_MISSING              — `artifact.data.session_file` absent.
 *   - SESSION_FILE_EMPTY                — string ou content vide.
 *   - SESSION_FILE_TOO_LARGE            — > max_size_mb.
 *   - SESSION_FILE_TOO_FEW_MESSAGES     — JSONL parsé < min_messages.
 *   - SESSION_FILE_INVALID_JSONL        — au moins une ligne non JSON-parseable.
 */
import { defineGate } from "@mnm/governed-workflows";

interface ArtifactWithData {
  data?: { session_file?: unknown };
}

type WrappedBundle = { encoding: string; content: string };

interface GateConfig {
  min_messages?: unknown;
  max_size_mb?: unknown;
}

const DEFAULT_MAX_SIZE_MB = 150;
const DEFAULT_MIN_MESSAGES = 1;

const SESSION_CAPTURE_HINT =
  "Bundle the Claude Code session file at artifact.data.session_file " +
  "(read ~/.claude/projects/<cwd-dashed>/<sessionId>.jsonl, see launch_governed_step.session_capture).";

function isWrapped(v: unknown): v is WrappedBundle {
  return (
    typeof v === "object" &&
    v !== null &&
    "encoding" in v &&
    "content" in v &&
    typeof (v as { encoding: unknown }).encoding === "string" &&
    typeof (v as { content: unknown }).content === "string"
  );
}

export default defineGate<ArtifactWithData, GateConfig>(async (ctx) => {
  // 1. Validate config first so authors get fast feedback on workflow.json mistakes.
  const minMessagesRaw = ctx.config.min_messages;
  const minMessages =
    minMessagesRaw === undefined
      ? DEFAULT_MIN_MESSAGES
      : typeof minMessagesRaw === "number" && Number.isInteger(minMessagesRaw) && minMessagesRaw >= 0
        ? minMessagesRaw
        : NaN;
  if (Number.isNaN(minMessages)) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "session-file-bundled: config.min_messages must be a non-negative integer",
    };
  }

  const maxSizeRaw = ctx.config.max_size_mb;
  const maxSizeMb =
    maxSizeRaw === undefined
      ? DEFAULT_MAX_SIZE_MB
      : typeof maxSizeRaw === "number" && maxSizeRaw > 0
        ? maxSizeRaw
        : NaN;
  if (Number.isNaN(maxSizeMb)) {
    return {
      pass: false,
      error_code: "GATE_INVALID_CONFIG",
      report: "session-file-bundled: config.max_size_mb must be a positive number",
    };
  }
  const maxBytes = maxSizeMb * 1024 * 1024;

  // 2. Locate the session_file in the artifact.
  const sessionFile = ctx.artifact?.data?.session_file;
  if (sessionFile === undefined || sessionFile === null) {
    return {
      pass: false,
      error_code: "SESSION_FILE_MISSING",
      report: "session-file-bundled: artifact.data.session_file is required",
      hints: [SESSION_CAPTURE_HINT],
    };
  }

  // 3. Normalise the shape: raw string or { encoding, content }.
  let encoding: "raw" | "gzip-base64";
  let content: string;
  if (typeof sessionFile === "string") {
    encoding = "raw";
    content = sessionFile;
  } else if (isWrapped(sessionFile)) {
    if (sessionFile.encoding !== "raw" && sessionFile.encoding !== "gzip-base64") {
      return {
        pass: false,
        error_code: "GATE_INVALID_CONFIG",
        report: `session-file-bundled: unknown encoding '${sessionFile.encoding}' (expected 'raw' or 'gzip-base64')`,
      };
    }
    encoding = sessionFile.encoding;
    content = sessionFile.content;
  } else {
    return {
      pass: false,
      error_code: "SESSION_FILE_MISSING",
      report: "session-file-bundled: artifact.data.session_file must be a string or { encoding, content }",
      hints: [SESSION_CAPTURE_HINT],
    };
  }

  // 4. Empty + size checks (apply to both encodings).
  if (content.length === 0) {
    return {
      pass: false,
      error_code: "SESSION_FILE_EMPTY",
      report: "session-file-bundled: session_file content is empty",
      hints: [SESSION_CAPTURE_HINT],
    };
  }
  if (content.length > maxBytes) {
    return {
      pass: false,
      error_code: "SESSION_FILE_TOO_LARGE",
      report: `session-file-bundled: session_file is ${content.length} bytes, max ${maxBytes} (${maxSizeMb} MB)`,
      hints: [
        `Compress the session with gzip+base64 (encoding: 'gzip-base64') or split the step into smaller chunks.`,
      ],
    };
  }

  // 5. For gzip-base64, presence + size are enough — the host decompresses + parses
  //    in finalizeClientRun. We only do a cheap surface sanity check on the magic
  //    bytes prefix in base64 ('H4sI' is the gzip magic 0x1f 0x8b encoded).
  if (encoding === "gzip-base64") {
    if (!content.startsWith("H4sI")) {
      return {
        pass: false,
        error_code: "SESSION_FILE_INVALID_JSONL",
        report: "session-file-bundled: gzip-base64 content does not start with gzip magic 'H4sI'",
        hints: ["Make sure you base64-encoded the gzipped JSONL, not the plain bytes."],
      };
    }
    return {
      pass: true,
      report: `session-file-bundled: bundled (${content.length} bytes, encoding=gzip-base64, parse deferred to server)`,
    };
  }

  // 6. Raw JSONL — parse line by line. Tolerate a trailing empty line.
  const lines = content.split("\n").filter((l) => l.length > 0);
  if (lines.length < minMessages) {
    return {
      pass: false,
      error_code: "SESSION_FILE_TOO_FEW_MESSAGES",
      report: `session-file-bundled: ${lines.length} message(s), expected at least ${minMessages}`,
      hints: [SESSION_CAPTURE_HINT],
    };
  }
  for (let i = 0; i < lines.length; i++) {
    try {
      JSON.parse(lines[i]!);
    } catch {
      return {
        pass: false,
        error_code: "SESSION_FILE_INVALID_JSONL",
        report: `session-file-bundled: line ${i + 1} is not valid JSON`,
        hints: ["The .jsonl must contain one JSON object per line, newline-separated."],
      };
    }
  }

  return {
    pass: true,
    report: `session-file-bundled: bundled ${lines.length} message(s) (${content.length} bytes, encoding=raw)`,
  };
});
