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
  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data]);

  const sounds: UploadedSound[] = useMemo(() => data?.sounds ?? [], [data]);

  const save = useMutation({
    mutationFn: (next: SoundSettings) => soundSettingsApi.update(selectedCompanyId!, next),
    onSuccess: (res) => {
      setDraft(res.settings);
      void queryClient.invalidateQueries({ queryKey: queryKeys.soundSettings.me(selectedCompanyId!) });
    },
  });

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
    audio.volume = Math.min(1, Math.max(0, draft.volume / 100));
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
            <Label className="text-base">Activer les sons</Label>
            <p className="text-sm text-muted-foreground">Jouer un son à chaque notification.</p>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>
        <div className="space-y-2">
          <Label>Volume — {draft.volume}%</Label>
          <Slider
            value={[draft.volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setDraft((d) => ({ ...d, volume: v }))}
            onValueCommit={([v]) => update({ volume: v })}
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <Label className="text-base">Son par type de notification</Label>
        {TONE_KEYS.map((tone) => (
          <div key={tone} className="flex items-center gap-3">
            <span className="w-32 text-sm">{TONE_LABELS[tone]}</span>
            <Select
              value={draft.tones[tone]}
              onValueChange={(v) => update({ tones: { ...draft.tones, [tone]: v } })}
            >
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => preview(draft.tones[tone])}>
              ▶ Aperçu
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
