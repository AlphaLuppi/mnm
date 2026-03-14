import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

export function useCurrentUser() {
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isAuthenticatedMode = health?.deploymentMode === "authenticated";

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  return {
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isAuthenticatedMode,
  };
}
