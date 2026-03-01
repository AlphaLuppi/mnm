import type { AppError } from '@shared/types/error.types'
import { useProjectStore } from '@renderer/stores/project.store'

type OpenProjectScreenProps = {
  error?: AppError
}

const ERROR_MESSAGES: Record<string, string> = {
  NOT_GIT_REPO: "Ce repertoire n'est pas un repo Git",
  INVALID_DIRECTORY: 'Repertoire invalide ou inaccessible',
  PERMISSION_DENIED: "Permission refusee. Verifiez les droits d'acces.",
  PROJECT_LOAD_FAILED: 'Erreur lors du chargement du projet',
  IPC_ERROR: 'Erreur de communication avec le processus principal'
}

export function OpenProjectScreen({ error }: OpenProjectScreenProps) {
  const openProject = useProjectStore((s) => s.openProject)
  const projectStatus = useProjectStore((s) => s.project.status)

  const isLoading = projectStatus === 'loading'

  const handleOpen = () => {
    openProject()
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-6">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-text-primary">MnM</h1>
          <p className="text-sm text-text-muted">IDE de supervision agentique</p>
        </div>

        {/* Open button */}
        <button
          onClick={handleOpen}
          disabled={isLoading}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {isLoading ? 'Chargement...' : 'Ouvrir un projet'}
        </button>

        <p className="text-xs text-text-muted">Selectionnez un repertoire Git local</p>

        {/* Error display */}
        {error && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-status-red/30 bg-status-red/10 px-6 py-3">
            <p className="text-sm text-status-red">
              {ERROR_MESSAGES[error.code] ?? error.message}
            </p>
            <button
              onClick={handleOpen}
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
