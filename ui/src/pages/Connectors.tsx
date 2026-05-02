import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, Plus, Trash2, ExternalLink, KeyRound } from "lucide-react";
import {
  connectorsApi,
  type Connector,
  type ConnectorTemplate,
  type CreateConnectorPayload,
} from "../api/connectors";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WizardStep = "details" | "credentials";

interface WizardState {
  open: boolean;
  template: ConnectorTemplate | null;
  step: WizardStep;
  displayName: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  apiKeyLabel: string;
}

const wizardInitial: WizardState = {
  open: false,
  template: null,
  step: "details",
  displayName: "",
  scopes: [],
  clientId: "",
  clientSecret: "",
  apiKeyLabel: "",
};

export function Connectors() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"mine" | "add">("mine");
  const [wizard, setWizard] = useState<WizardState>(wizardInitial);
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Connecteurs" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data: connectorsData, isLoading: isLoadingConnectors } = useQuery({
    queryKey: queryKeys.connectors.list(selectedCompanyId!),
    queryFn: () => connectorsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: templatesData } = useQuery({
    queryKey: queryKeys.connectors.templates(selectedCompanyId!),
    queryFn: () => connectorsApi.templates(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const connectors = useMemo(
    () => connectorsData?.connectors ?? [],
    [connectorsData],
  );
  const templates = useMemo(() => templatesData?.templates ?? [], [templatesData]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateConnectorPayload) =>
      connectorsApi.create(selectedCompanyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
      setWizard(wizardInitial);
      setActiveTab("mine");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      connectorsApi.update(selectedCompanyId!, id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => connectorsApi.remove(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
      setDeleteTarget(null);
    },
  });

  function openWizardFromTemplate(template: ConnectorTemplate) {
    setWizard({
      open: true,
      template,
      step: "details",
      displayName: template.displayName,
      scopes: [...(template.scopes ?? [])],
      clientId: "",
      clientSecret: "",
      apiKeyLabel: template.apiKeyLabel ?? "",
    });
  }

  function submitWizard() {
    if (!wizard.template) return;
    const payload: CreateConnectorPayload = {
      templateSlug: wizard.template.slug,
      displayName: wizard.displayName.trim() || wizard.template.displayName,
      scopes: wizard.scopes,
    };
    if (wizard.template.type === "oauth2") {
      payload.clientId = wizard.clientId.trim();
      payload.clientSecret = wizard.clientSecret.trim();
    } else {
      payload.apiKeyLabel = wizard.apiKeyLabel.trim();
    }
    createMutation.mutate(payload);
  }

  if (!selectedCompanyId) return <PageSkeleton />;
  if (isLoadingConnectors) return <PageSkeleton />;

  const canSubmitWizard =
    wizard.template?.type === "api_key"
      ? wizard.displayName.trim().length > 0 && wizard.apiKeyLabel.trim().length > 0
      : wizard.displayName.trim().length > 0 &&
        wizard.clientId.trim().length > 0 &&
        wizard.clientSecret.trim().length > 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6" />
            Connecteurs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure les connecteurs OAuth et API key utilisés par les hooks et les
            agents au nom des utilisateurs de la company.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "mine" | "add")}>
        <TabsList>
          <TabsTrigger value="mine" data-testid="connectors-tab-mine">
            Mes connecteurs ({connectors.length})
          </TabsTrigger>
          <TabsTrigger value="add" data-testid="connectors-tab-add">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-6">
          {connectors.length === 0 ? (
            <EmptyState
              icon={Plug}
              message="Aucun connecteur configuré. Ajoute-en un depuis l'onglet « Ajouter » pour permettre aux utilisateurs de connecter leur compte Jira, GitHub, OpenAI, etc."
              action="Ajouter un connecteur"
              onAction={() => setActiveTab("add")}
            />
          ) : (
            <div className="grid gap-4">
              {connectors.map((c) => (
                <ConnectorRow
                  key={c.id}
                  connector={c}
                  onToggleEnabled={(enabled) =>
                    updateMutation.mutate({ id: c.id, enabled })
                  }
                  onDelete={() => setDeleteTarget(c)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <TemplateCard
                key={t.slug}
                template={t}
                onClick={() => openWizardFromTemplate(t)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Wizard dialog */}
      <Dialog
        open={wizard.open}
        onOpenChange={(o) => !o && setWizard(wizardInitial)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Configurer {wizard.template?.displayName ?? "le connecteur"}
            </DialogTitle>
            <DialogDescription>
              {wizard.template?.type === "api_key"
                ? "Le connecteur utilisera une clé API que chaque utilisateur fournira après la création."
                : "Le connecteur OAuth nécessite un client_id et un client_secret obtenus auprès du fournisseur."}
            </DialogDescription>
          </DialogHeader>

          {wizard.step === "details" && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="displayName">Nom affiché</Label>
                <Input
                  id="displayName"
                  data-testid="connectors-wizard-display-name"
                  value={wizard.displayName}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, displayName: e.target.value }))
                  }
                />
              </div>

              {wizard.template?.type === "oauth2" && (
                <div>
                  <Label>Scopes recommandés</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(wizard.template.scopes ?? []).map((scope) => {
                      const checked = wizard.scopes.includes(scope);
                      return (
                        <Badge
                          key={scope}
                          variant={checked ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            setWizard((w) => ({
                              ...w,
                              scopes: checked
                                ? w.scopes.filter((s) => s !== scope)
                                : [...w.scopes, scope],
                            }))
                          }
                        >
                          {scope}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {wizard.template?.type === "api_key" && (
                <div>
                  <Label htmlFor="apiKeyLabel">Libellé clé (env var)</Label>
                  <Input
                    id="apiKeyLabel"
                    data-testid="connectors-wizard-api-key-label"
                    value={wizard.apiKeyLabel}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, apiKeyLabel: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {wizard.step === "credentials" && wizard.template?.type === "oauth2" && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  data-testid="connectors-wizard-client-id"
                  value={wizard.clientId}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, clientId: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  data-testid="connectors-wizard-client-secret"
                  type="password"
                  value={wizard.clientSecret}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, clientSecret: e.target.value }))
                  }
                />
              </div>
              {wizard.template?.docsUrl && (
                <a
                  href={wizard.template.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline"
                >
                  Configurer une OAuth app{" "}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setWizard(wizardInitial)}
              disabled={createMutation.isPending}
            >
              Annuler
            </Button>

            {wizard.template?.type === "oauth2" && wizard.step === "details" && (
              <Button
                onClick={() => setWizard((w) => ({ ...w, step: "credentials" }))}
                data-testid="connectors-wizard-next"
                disabled={wizard.displayName.trim().length === 0}
              >
                Suivant
              </Button>
            )}

            {(wizard.template?.type === "api_key" ||
              (wizard.template?.type === "oauth2" && wizard.step === "credentials")) && (
              <Button
                onClick={submitWizard}
                disabled={!canSubmitWizard || createMutation.isPending}
                data-testid="connectors-wizard-submit"
              >
                {createMutation.isPending ? "Création..." : "Créer le connecteur"}
              </Button>
            )}
          </DialogFooter>

          {createMutation.error && (
            <p className="text-sm text-destructive mt-2">
              {(createMutation.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le connecteur ?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.displayName} sera supprimé. Tous les comptes utilisateur
              connectés via ce connecteur seront déconnectés (cascade).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="connectors-delete-confirm"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({
  template,
  onClick,
}: {
  template: ConnectorTemplate;
  onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
      data-testid={`connectors-template-${template.slug}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{template.displayName}</CardTitle>
          <Badge variant={template.type === "oauth2" ? "default" : "secondary"}>
            {template.type === "oauth2" ? "OAuth" : "API Key"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-xs">{template.tagline}</CardDescription>
      </CardContent>
    </Card>
  );
}

function ConnectorRow({
  connector,
  onToggleEnabled,
  onDelete,
}: {
  connector: Connector;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Card data-testid={`connectors-row-${connector.providerSlug}`}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {connector.type === "api_key" ? (
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Plug className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">{connector.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {connector.providerSlug}
              {connector.type === "oauth2" && connector.clientSecretConfigured
                ? " · client_secret configuré"
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={connector.type === "oauth2" ? "default" : "secondary"}>
            {connector.type === "oauth2" ? "OAuth" : "API Key"}
          </Badge>
          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              onCheckedChange={onToggleEnabled}
              data-testid={`connectors-toggle-${connector.providerSlug}`}
            />
            <Label className="text-xs text-muted-foreground">
              {connector.enabled ? "Activé" : "Désactivé"}
            </Label>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            data-testid={`connectors-delete-${connector.providerSlug}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
