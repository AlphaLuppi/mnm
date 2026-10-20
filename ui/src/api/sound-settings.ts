import type { SoundSettings, UpdateSoundSettings } from "@mnm/shared";
import { api } from "./client";

export interface UploadedSound {
  id: string;
  label: string;
  contentType: string;
}

export const soundSettingsApi = {
  get: (companyId: string) =>
    api.get<{ settings: SoundSettings; sounds: UploadedSound[] }>(
      `/companies/${companyId}/me/sound-settings`,
    ),
  update: (companyId: string, patch: UpdateSoundSettings) =>
    api.put<{ settings: SoundSettings }>(
      `/companies/${companyId}/me/sound-settings`,
      patch,
    ),
  upload: async (companyId: string, file: File) => {
    const buffer = await file.arrayBuffer();
    const safe = new File([buffer], file.name, { type: file.type });
    const form = new FormData();
    form.append("file", safe);
    return api.postForm<{ sound: UploadedSound }>(`/companies/${companyId}/me/sounds`, form);
  },
};
