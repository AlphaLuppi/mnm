import { Link } from "react-router-dom";
import { User, Mail, Link2, ArrowRight } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

export default function UserProfile() {
  const { user } = useCurrentUser();

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" /> Profil
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérer votre compte MnM.
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
            <Link2 className="h-4 w-4" /> Comptes externes
          </CardTitle>
          <CardDescription>
            La gestion des comptes externes (Jira, GitLab, GitHub, OpenAI…) se
            fait depuis la page dédiée. Chaque connecteur est configuré par un
            administrateur depuis Admin &gt; Connecteurs, puis chaque user lie
            son compte personnel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings/accounts">
              Mes connecteurs
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
