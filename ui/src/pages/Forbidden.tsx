import { Link } from "@/lib/router";
import { ShieldX } from "lucide-react";

export function ForbiddenPage() {
  return (
    <div
      data-testid="rbac-s05-forbidden-page"
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4"
    >
      <ShieldX className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Acces refuse</h1>
      <p
        data-testid="rbac-s05-forbidden-message"
        className="text-sm text-muted-foreground max-w-md"
      >
        Vous n'avez pas acces a cette page. Contactez votre administrateur.
      </p>
      <Link
        to="/dashboard"
        data-testid="rbac-s05-forbidden-back-link"
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Retour au Dashboard
      </Link>
    </div>
  );
}
