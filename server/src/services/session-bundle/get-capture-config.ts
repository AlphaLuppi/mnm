/**
 * Session capture config — paramétrable côté serveur, lu par le harness.
 *
 * Servi dans la réponse de `launch_governed_step` quand le step a la gate
 * `session-file-bundled` activée, et dans `hints[]` de la gate elle-même
 * en cas d'échec. Le harness (Claude Code) suit le `path_template` pour
 * trouver son propre `.jsonl` et le bundler dans
 * `artifact.data.session_file` au moment du `complete_governed_step`.
 *
 * Si Anthropic change la convention (ex: nouveau path layout), on patche
 * UNIQUEMENT le template côté serveur via env var. Le harness re-fetch à
 * chaque step → zéro hardcode côté client.
 *
 * V1 : config globale process-wide via env vars.
 *      `companyId` accepté en argument mais ignoré (futur override per-tenant).
 */

export type SessionCaptureMethod = "claude-code-jsonl-v1";

export interface SessionCaptureConfig {
  /** Identifiant versionné — détermine quel parser le serveur appliquera. */
  method: SessionCaptureMethod;
  /** Format de bundle correspondant (égal à method en V1). */
  bundle_format: SessionCaptureMethod;
  /**
   * Template du chemin du fichier de session, avec placeholders :
   *   ${HOME}        — home directory du user
   *   ${CWD_DASHED}  — cwd avec '/' → '-' et préfixé '-' (Claude Code convention)
   *   ${SESSION_ID}  — UUID du session JSONL
   * Le harness résout les placeholders et lit le fichier résultant.
   */
  path_template: string;
  /** Comment récupérer le sessionId à substituer dans path_template. */
  session_id_source: string;
  /** Champ artifact où poster le contenu. */
  where_to_put: "artifact.data.session_file";
  /**
   * Cap en MB sur la taille du contenu (raw ou base64) au moment du complete.
   * Au-delà, le complete fail avec SESSION_FILE_TOO_LARGE.
   */
  max_size_mb: number;
  /**
   * Au-dessus de ce seuil (raw bytes), le harness DOIT compresser avec
   * gzip+base64 et utiliser l'enveloppe { encoding: "gzip-base64", content }.
   * En-dessous, raw string acceptée.
   */
  gzip_threshold_mb: number;
  /** Bloc d'instructions pour Claude Code à inclure dans le tool response. */
  instructions: string;
}

const ALLOWED_METHODS: ReadonlySet<SessionCaptureMethod> = new Set(["claude-code-jsonl-v1"]);

const DEFAULT_INSTRUCTIONS =
  "Avant d'appeler complete_governed_step, lis ton fichier de session JSONL " +
  "(résous path_template avec ${HOME}, ${CWD_DASHED}, ${SESSION_ID}) et passe " +
  "son contenu intégral dans artifact.data.session_file. Si la taille brute " +
  "dépasse gzip_threshold_mb, gzip+base64 le contenu et utilise " +
  "{ encoding: 'gzip-base64', content }. Sinon une string brute suffit. " +
  "${SESSION_ID} = champ 'sessionId' présent dans chaque ligne JSONL " +
  "(différent de la variable d'env CLAUDE_CODE_SESSION_ID qui pointe sur " +
  "la session remote, format cse_*). ${CWD_DASHED} = ton cwd avec '/' " +
  "remplacés par '-' et préfixé '-' (ex: /home/user/mnm → -home-user-mnm).";

export const DEFAULT_CAPTURE_CONFIG: SessionCaptureConfig = {
  method: "claude-code-jsonl-v1",
  bundle_format: "claude-code-jsonl-v1",
  path_template: "${HOME}/.claude/projects/${CWD_DASHED}/${SESSION_ID}.jsonl",
  session_id_source: "any line of the active jsonl, field 'sessionId' (UUID v4)",
  where_to_put: "artifact.data.session_file",
  max_size_mb: 100,
  gzip_threshold_mb: 5,
  instructions: DEFAULT_INSTRUCTIONS,
};

function readPositiveNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function readMethodEnv(key: string, fallback: SessionCaptureMethod): SessionCaptureMethod {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return ALLOWED_METHODS.has(raw as SessionCaptureMethod) ? (raw as SessionCaptureMethod) : fallback;
}

export interface GetCaptureConfigOpts {
  /** V1 : ignoré. Futur : permet un override per-tenant via une table company_settings. */
  companyId?: string;
}

export function getCaptureConfig(_opts: GetCaptureConfigOpts = {}): SessionCaptureConfig {
  const method = readMethodEnv("MNM_SESSION_CAPTURE_METHOD", DEFAULT_CAPTURE_CONFIG.method);
  const pathTemplate = process.env.MNM_SESSION_CAPTURE_PATH_TEMPLATE ?? DEFAULT_CAPTURE_CONFIG.path_template;
  const maxSizeMb = readPositiveNumberEnv("MNM_SESSION_CAPTURE_MAX_SIZE_MB", DEFAULT_CAPTURE_CONFIG.max_size_mb);
  const gzipThresholdMb = readPositiveNumberEnv(
    "MNM_SESSION_CAPTURE_GZIP_THRESHOLD_MB",
    DEFAULT_CAPTURE_CONFIG.gzip_threshold_mb,
  );

  return {
    method,
    bundle_format: method,
    path_template: pathTemplate,
    session_id_source: DEFAULT_CAPTURE_CONFIG.session_id_source,
    where_to_put: "artifact.data.session_file",
    max_size_mb: maxSizeMb,
    gzip_threshold_mb: gzipThresholdMb,
    instructions: DEFAULT_CAPTURE_CONFIG.instructions,
  };
}
