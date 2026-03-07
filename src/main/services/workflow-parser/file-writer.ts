import { promises as fs } from 'node:fs'
import type { AppError } from '@shared/types/error.types'

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`

  try {
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, filePath)
  } catch (err) {
    try {
      await fs.unlink(tempPath)
    } catch {
      // Ignore cleanup errors
    }

    const appError: AppError = {
      code: 'WORKFLOW_SAVE_ERROR',
      message: `Echec de l'ecriture du fichier workflow: ${filePath}`,
      source: 'workflow-parser',
      details: err
    }
    throw appError
  }
}
