import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Check, AlertTriangle, User, Mail } from "lucide-react";
import { authApi, type LinkedAccount } from "../api/auth";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";

type ProviderInfo = {
  id: "gitlab" | "microsoft";
  label: string;
  description: string;
  scopes: string[];
  commitCapable: boolean;
};

const PROVIDERS: ProviderInfo[] = [
  {
    id: "gitlab",
    label: "GitLab (gitlab.example.com)",
    description:
      "Permet de committer les Governed Workflows sous votre identité GitLab. Les commits apparaissent à votre nom dans l'historique gitlab.example.com.",
    scopes: ["api", "read_repository", "write_repository"],
    commitCapable: true,
  },
  {
    id: "microsoft",
    label: "Microsoft / Entra ID",
    description:
      "Identité your organization via Azure AD. Utile si vous n'avez pas d'accès GitLab. Les commits Governed Workflows retombent sur le token de la company.",
    scopes: ["User.Read"],
    commitCapable: false,
  },
];

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t < Date.now();
}

export default function UserProfile() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const linkedQuery = useQuery({
    queryKey: ["auth", "linked-accounts"],
    queryFn: authApi.listLinkedAccounts,
  });

  const unlinkMutation = useMutation({
    mutationFn: (args: { providerId: string; accountId?: string }) =>
      authApi.unlinkAccount(args.providerId, args.accountId),
    onSuccess: () => {
      setUnlinkError(null);
      qc.invalidateQueries({ queryKey: ["auth", "linked-accounts"] });
    },
    onError: (err: Error) => {
      setUnlinkError(err.message);
    },
  });

  async function handleLink(providerId: "gitlab" | "microsoft") {
    setLinkingProvider(providerId);
    try {
      await authApi.linkSocial(providerId, `${window.location.origin}/settings/profile`);
      // linkSocial triggers a redirect; nothing more to do here.
    } catch (err) {
      setLinkingProvider(null);
      alert(err instanceof Error ? err.message : "Link failed");
    }
  }

  const accounts = linkedQuery.data ?? [];
  const accountsByProvider = new Map<string, LinkedAccount>();
  for (const a of accounts) accountsByProvider.set(a.providerId, a);

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" /> Profil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérer votre compte MnM et les identités externes liées.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Identité MnM
          </CardTitle>
          <CardDescription>Votre session actuelle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Nom : </span>
            <span className="font-medium">{user?.name ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email : </span>
            <span className="font-medium">{user?.email ?? "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">User ID : </span>
            <span className="font-mono text-xs">{user?.id ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Comptes connectés
          </CardTitle>
          <CardDescription>
            Liez une identité externe à votre compte MnM pour autoriser les opérations
            qui en dépendent (notamment committer des Governed Workflows sous votre
            nom sur GitLab).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkedQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement...</div>
          ) : linkedQuery.error ? (
            <div className="text-sm text-destructive">
              Erreur : {(linkedQuery.error as Error).message}
            </div>
          ) : (
            PROVIDERS.map((p) => {
              const linked = accountsByProvider.get(p.id) ?? null;
              const expired = linked ? isExpired(linked.accessTokenExpiresAt) : false;
              return (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-4 border rounded-md p-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{p.label}</span>
                      {linked && !expired && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Connecté
                        </Badge>
                      )}
                      {linked && expired && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Token expiré
                        </Badge>
                      )}
                      {!linked && p.commitCapable && (
                        <Badge variant="outline">Recommandé pour les devs</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {p.description}
                    </p>
                    {linked && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        <div>
                          Account ID :{" "}
                          <span className="font-mono">{linked.accountId}</span>
                        </div>
                        {linked.scopes.length > 0 && (
                          <div>Scopes : {linked.scopes.join(", ")}</div>
                        )}
                        {linked.accessTokenExpiresAt && (
                          <div>
                            Token expire le :{" "}
                            {new Date(linked.accessTokenExpiresAt).toLocaleString("fr-FR")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {linked ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Dissocier
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Dissocier {p.label} ?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Votre session MnM restera active. Vous ne pourrez plus
                              committer les Governed Workflows sous cette identité.
                              Vous pourrez relier ce compte plus tard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                unlinkMutation.mutate({
                                  providerId: p.id,
                                  accountId: linked.accountId,
                                })
                              }
                            >
                              Dissocier
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        size="sm"
                        disabled={linkingProvider === p.id}
                        onClick={() => handleLink(p.id)}
                      >
                        {linkingProvider === p.id ? "Redirection..." : `Connecter ${p.label.split(" ")[0]}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {unlinkError && (
            <div className="text-sm text-destructive border border-destructive/40 rounded p-2">
              {unlinkError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
