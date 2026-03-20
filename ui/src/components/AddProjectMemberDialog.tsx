import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PROJECT_MEMBERSHIP_ROLES, type ProjectMembershipRole } from "@mnm/shared";
import { accessApi } from "../api/access";
import { projectMembershipsApi } from "../api/project-memberships";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROJECT_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  contributor: "Contributor",
  viewer: "Viewer",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface AddProjectMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId: string;
  existingMemberIds: string[];
}

export function AddProjectMemberDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  existingMemberIds,
}: AddProjectMemberDialogProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<ProjectMembershipRole>("contributor");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.members(companyId),
    queryFn: () => accessApi.listMembers(companyId),
    enabled: open && !!companyId,
  });

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  const availableMembers = useMemo(() => {
    if (!companyMembers) return [];
    return companyMembers.filter((m) => !existingSet.has(m.principalId));
  }, [companyMembers, existingSet]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return availableMembers;
    const q = searchQuery.toLowerCase();
    return availableMembers.filter((m) => {
      const name = (m.userName ?? "").toLowerCase();
      const email = (m.userEmail ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [availableMembers, searchQuery]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const addSingleMutation = useMutation({
    mutationFn: (userId: string) =>
      projectMembershipsApi.addMember(companyId, projectId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectMemberships.list(companyId, projectId),
      });
      setSuccessMsg("1 member added");
      setSelectedUserIds(new Set());
      setTimeout(() => {
        setSuccessMsg(null);
        onOpenChange(false);
      }, 1500);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add member");
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      projectMembershipsApi.bulkAddMembers(companyId, projectId, userIds, role),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectMemberships.list(companyId, projectId),
      });
      setSuccessMsg(`${result.added ?? 0} members added, ${result.skipped} skipped`);
      setSelectedUserIds(new Set());
      setTimeout(() => {
        setSuccessMsg(null);
        onOpenChange(false);
      }, 1500);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add members");
    },
  });

  const handleSubmit = () => {
    setError(null);
    setSuccessMsg(null);
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) return;
    if (ids.length === 1) {
      addSingleMutation.mutate(ids[0]);
    } else {
      bulkAddMutation.mutate(ids);
    }
  };

  const isPending = addSingleMutation.isPending || bulkAddMutation.isPending;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery("");
      setSelectedUserIds(new Set());
      setRole("contributor");
      setError(null);
      setSuccessMsg(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="proj-s04-add-dialog" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="proj-s04-add-dialog-title">
            Add Members to Project
          </DialogTitle>
          <DialogDescription>
            Select company members to add to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="proj-s04-add-search"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Role select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Select value={role} onValueChange={(val) => setRole(val as ProjectMembershipRole)}>
              <SelectTrigger
                data-testid="proj-s04-add-role-select"
                size="sm"
                className="w-[140px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_MEMBERSHIP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {PROJECT_ROLE_LABELS[r] ?? r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Available members list */}
          <div
            data-testid="proj-s04-available-members-list"
            className="max-h-60 overflow-y-auto border border-border rounded-md"
          >
            {filteredMembers.length === 0 ? (
              <div
                data-testid="proj-s04-no-available"
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {availableMembers.length === 0
                  ? "All company members are already in this project."
                  : "No members match your search."}
              </div>
            ) : (
              filteredMembers.map((member) => (
                <label
                  key={member.principalId}
                  data-testid={`proj-s04-available-member-${member.principalId}`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 cursor-pointer border-b border-border last:border-b-0"
                >
                  <Checkbox
                    data-testid={`proj-s04-available-member-check-${member.principalId}`}
                    checked={selectedUserIds.has(member.principalId)}
                    onCheckedChange={() => toggleUser(member.principalId)}
                  />
                  <Avatar className="h-7 w-7">
                    {member.userImage && (
                      <AvatarImage src={member.userImage} alt={member.userName ?? ""} />
                    )}
                    <AvatarFallback className="text-xs">
                      {getInitials(member.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div
                      data-testid={`proj-s04-available-member-name-${member.principalId}`}
                      className="text-sm font-medium truncate"
                    >
                      {member.userName ?? member.principalId}
                    </div>
                    {member.userEmail && (
                      <div
                        data-testid={`proj-s04-available-member-email-${member.principalId}`}
                        className="text-xs text-muted-foreground truncate"
                      >
                        {member.userEmail}
                      </div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Selected count */}
          <div
            data-testid="proj-s04-selected-count"
            className="text-xs text-muted-foreground"
          >
            {selectedUserIds.size} selected
          </div>

          {/* Error message */}
          {error && (
            <div
              data-testid="proj-s04-add-error"
              className="text-xs text-destructive"
            >
              {error}
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div
              data-testid="proj-s04-add-success"
              className="text-xs text-green-600"
            >
              {successMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            data-testid="proj-s04-add-cancel"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            data-testid="proj-s04-add-submit"
            onClick={handleSubmit}
            disabled={selectedUserIds.size === 0 || isPending}
          >
            {isPending
              ? "Adding..."
              : `Add Selected (${selectedUserIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
