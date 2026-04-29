/**
 * React Query hooks around the Tauri profile bridge. All queries are disabled
 * in web mode (`isTauri() === false`) so the web build never dispatches an
 * `invoke` call that would throw.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { isTauri } from "@/lib/runtime";
import type {
  Profile,
  ProfileCreateInput,
  ProfilePatch,
} from "@/lib/profile-types";
import {
  addProfile,
  getCachedActiveProfile,
  listProfiles,
  removeProfile,
  setActiveProfile,
  updateProfile,
} from "@/lib/profile-client";

const profilesListKey = ["profiles", "list"] as const;
const profilesActiveKey = ["profiles", "active"] as const;

async function invalidateProfilesQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: profilesListKey }),
    queryClient.invalidateQueries({ queryKey: profilesActiveKey }),
  ]);
}

export function useProfilesList(): UseQueryResult<Profile[], Error> {
  return useQuery<Profile[], Error>({
    queryKey: profilesListKey,
    queryFn: () => listProfiles(),
    enabled: isTauri(),
  });
}

export function useActiveProfile(): UseQueryResult<Profile | null, Error> {
  return useQuery<Profile | null, Error>({
    queryKey: profilesActiveKey,
    // The active profile is cached in-memory by profile-client. We expose it
    // through React Query so consumers can reactively re-render when
    // mutations invalidate the key.
    queryFn: async () => getCachedActiveProfile(),
    enabled: isTauri(),
  });
}

export function useAddProfile(): UseMutationResult<
  Profile,
  Error,
  ProfileCreateInput
> {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, ProfileCreateInput>({
    mutationFn: (input: ProfileCreateInput) => addProfile(input),
    onSuccess: async () => {
      await invalidateProfilesQueries(queryClient);
    },
  });
}

export function useUpdateProfile(): UseMutationResult<
  Profile,
  Error,
  { id: string; patch: ProfilePatch }
> {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, { id: string; patch: ProfilePatch }>({
    mutationFn: ({ id, patch }) => updateProfile(id, patch),
    onSuccess: async () => {
      await invalidateProfilesQueries(queryClient);
    },
  });
}

export function useRemoveProfile(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => removeProfile(id),
    onSuccess: async () => {
      await invalidateProfilesQueries(queryClient);
    },
  });
}

export function useSetActiveProfile(): UseMutationResult<
  Profile,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, string>({
    mutationFn: (id: string) => setActiveProfile(id),
    onSuccess: async () => {
      await invalidateProfilesQueries(queryClient);
    },
  });
}
