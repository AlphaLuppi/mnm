import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Volume2 } from "lucide-react";
import type { SoundSettings, ToneKey } from "@mnm/shared";
import { DEFAULT_SOUND_SETTINGS, TONE_KEYS } from "@mnm/shared";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { soundSettingsApi, type UploadedSound } from "@/api/sound-settings";
import { queryKeys } from "@/lib/queryKeys";
import { BUILTIN_SOUNDS, builtinSoundUrl } from "@/sounds/manifest";
import { resolveSoundUrl } from "@/sounds/play";
import { toAudioVolume } from "@/context/SoundSettingsProvider";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TONE_LABELS: Record<ToneKey, string> = {
  info: "Info",
  success: "Succès",
  warn: "Avertissement",
  error: "Erreur",
};

export function SoundSettingsPage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Paramètres" }, { label: "Sons" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.soundSettings.me(selectedCompanyId!),
    queryFn: () => soundSettingsApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const [draft, setDraft] = useState<SoundSettings>(DEFAULT_SOUND_SETTINGS);

  const sounds: UploadedSound[] = useMemo(() => data?.sounds ?? [], [data]);

  const save = useMutation({
    mutationFn: (next: SoundSettings) => soundSettingsApi.update(selectedCompanyId!, next),
    // Serialize saves so rapid changes can't land out of order server-side.
    scope: { id: "sound-settings" },
    onSuccess: (res) => {
      // Update the cache only: the draft stays the source of truth while editing,
      // so a late response can't overwrite a newer local change.
      queryClient.setQueryData<typeof data>(
        queryKeys.soundSettings.me(selectedCompanyId!),
        (prev) => (prev ? { ...prev, settings: res.settings } : prev),
      );
    },
    onError: () => {
      // Roll back to the last known server state.
      if (data?.settings) setDraft(data.settings);
    },
  });

  // Sync the draft from the server only when no save is in flight, so a refetch
  // (focus, invalidation) never resets a value the user is editing.
  useEffect(() => {
    if (data?.settings && !save.isPending) setDraft(data.settings);
  }, [data, save.isPending]);

  const uploadMut = useMutation({
    mutationFn: (file: File) => soundSettingsApi.upload(selectedCompanyId!, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.soundSettings.me(selectedCompanyId!) }),
  });

  const update = (patch: Partial<SoundSettings>) => {
    const next = { ...draft, ...patch, tones: { ...draft.tones, ...(patch.tones ?? {}) } };
    setDraft(next);
    save.mutate(next);
  };

  const preview = (ref: string) => {
    if (!selectedCompanyId) return;
    const url = resolveSoundUrl(ref, {
      companyId: selectedCompanyId,
      builtins: BUILTIN_SOUNDS,
      builtinUrl: builtinSoundUrl,
    });
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = toAudioVolume(draft.volume);
    void audio.play().catch(() => {});
  };

  if (!selectedCompanyId || isLoading) {
    return <div className="container mx-auto py-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  const options = [
    { value: "none", label: "Aucun" },
    ...BUILTIN_SOUNDS.map((b) => ({ value: `builtin:${b.id}`, label: b.label })),
    ...sounds.map((s) => ({ value: `asset:${s.id}`, label: s.label })),
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="sound-enabled" className="text-base">Activer les sons</Label>
            <p className="text-sm text-muted-foreground">Jouer un son à chaque notification.</p>
          </div>
          <Switch
            id="sound-enabled"
            checked={draft.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sound-volume">Volume — {draft.volume}%</Label>
          <Slider
            id="sound-volume"
            aria-valuetext={`${draft.volume} %`}
            value={[draft.volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setDraft((d) => ({ ...d, volume: v }))}
            onValueCommit={([v]) => update({ volume: v })}
          />
        </div>
        {save.isError && (
          <p className="text-sm text-destructive">
            Échec de l'enregistrement — vos réglages précédents ont été restaurés.
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <Label className="text-base">Son par type de notification</Label>
        {TONE_KEYS.map((tone) => (
          <div key={tone} className="flex items-center gap-3">
            <span id={`sound-tone-${tone}`} className="w-32 text-sm">{TONE_LABELS[tone]}</span>
            <Select
              value={draft.tones[tone]}
              onValueChange={(v) => update({ tones: { ...draft.tones, [tone]: v } })}
            >
              <SelectTrigger className="flex-1" aria-labelledby={`sound-tone-${tone}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Aperçu du son ${TONE_LABELS[tone]}`}
              onClick={() => preview(draft.tones[tone])}
            >
              <span aria-hidden="true">▶</span> Aperçu
            </Button>
          </div>
        ))}
      </Card>

      <Card className="p-5 space-y-3">
        <Label className="text-base">Mes sons personnalisés</Label>
        <p className="text-sm text-muted-foreground">MP3, WAV, OGG ou WebM — max 2 Mo.</p>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            e.target.value = "";
          }}
        />
        <div>
          <Button variant="outline" disabled={uploadMut.isPending} onClick={() => fileRef.current?.click()}>
            <Volume2 className="h-4 w-4" />
            {uploadMut.isPending ? "Envoi…" : "Importer un son"}
          </Button>
        </div>
        {uploadMut.isError && (
          <p className="text-sm text-destructive">Échec de l'import (type ou taille invalide).</p>
        )}
      </Card>
    </div>
  );
}
