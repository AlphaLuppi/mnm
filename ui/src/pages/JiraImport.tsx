// onb-s03-jira-import-page

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompany } from "@/context/CompanyContext";
import { jiraImportApi, type JiraConnectionConfig } from "@/api/jira-import";
import { queryKeys } from "@/lib/queryKeys";
import { RequirePermission } from "@/components/RequirePermission";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle, XCircle, Loader2, ArrowLeft, ArrowRight } from "lucide-react";

type WizardStep = 1 | 2 | 3;

export function JiraImport() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>(1);
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const connectionConfig: JiraConnectionConfig = { baseUrl, email, apiToken };

  // Test connection mutation
  const connectMutation = useMutation({
    mutationFn: () => jiraImportApi.connect(companyId, connectionConfig),
    onSuccess: () => {
      setConnected(true);
      setConnectionError(null);
    },
    onError: (err) => {
      setConnected(false);
      setConnectionError(err instanceof Error ? err.message : "Connection failed");
    },
  });

  // Preview query (only when connected)
  const previewQuery = useQuery({
    queryKey: [...queryKeys.jiraImport.jobs(companyId), "preview"],
    queryFn: () => jiraImportApi.preview(companyId, connectionConfig),
    enabled: connected && step >= 2,
  });

  // Start import mutation
  const startMutation = useMutation({
    mutationFn: () =>
      jiraImportApi.start(companyId, {
        ...connectionConfig,
        projectKeys: Array.from(selectedProjects),
      }),
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: queryKeys.jiraImport.jobs(companyId) });
    },
  });

  // Active job polling
  const activeJobQuery = useQuery({
    queryKey: queryKeys.jiraImport.jobDetail(companyId, activeJobId ?? ""),
    queryFn: () => jiraImportApi.getJob(companyId, activeJobId!),
    enabled: !!activeJobId && step === 3,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") return false;
      return 2000;
    },
  });

  // Cancel import mutation
  const cancelMutation = useMutation({
    mutationFn: () => jiraImportApi.cancel(companyId, activeJobId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jiraImport.jobs(companyId) });
    },
  });

  // Import history
  const historyQuery = useQuery({
    queryKey: queryKeys.jiraImport.jobs(companyId),
    queryFn: () => jiraImportApi.listJobs(companyId),
    enabled: !!companyId,
  });

  const toggleProject = (key: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (previewQuery.data) {
      setSelectedProjects(new Set(previewQuery.data.projects.map((p) => p.key)));
    }
  };

  return (
    <RequirePermission permission="projects:manage" showForbidden>
      <div data-testid="onb-s03-import-page" className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Upload className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Import from Jira</h1>
        </div>

        {/* Step Indicator */}
        <div data-testid="onb-s03-step-indicator" className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : s < step
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
          ))}
          <span className="ml-2 self-center text-sm text-muted-foreground">
            {step === 1 ? "Connect" : step === 2 ? "Configure" : "Import"}
          </span>
        </div>

        {/* Step 1: Connect */}
        {step === 1 && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h2 className="text-lg font-semibold">Connect to Jira</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="jira-url">Jira Base URL</Label>
                <Input
                  id="jira-url"
                  data-testid="onb-s03-jira-url"
                  placeholder="https://yourcompany.atlassian.net"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  data-testid="onb-s03-jira-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="jira-token">API Token</Label>
                <Input
                  id="jira-token"
                  data-testid="onb-s03-jira-token"
                  type="password"
                  placeholder="Your Jira API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-testid="onb-s03-test-connection"
                onClick={() => connectMutation.mutate()}
                disabled={!baseUrl || !email || !apiToken || connectMutation.isPending}
              >
                {connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              <div data-testid="onb-s03-connection-status">
                {connected && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" /> Connected
                  </span>
                )}
                {connectionError && (
                  <span className="flex items-center gap-1 text-sm text-destructive">
                    <XCircle className="h-4 w-4" /> {connectionError}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                data-testid="onb-s03-next-step"
                onClick={() => setStep(2)}
                disabled={!connected}
              >
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <h2 className="text-lg font-semibold">Select Projects</h2>

            {previewQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
              </div>
            )}

            {previewQuery.data && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {previewQuery.data.projects.length} projects, {previewQuery.data.totalIssueCount} total issues
                  </span>
                  <Button variant="outline" size="sm" data-testid="onb-s03-select-all" onClick={selectAll}>
                    Select All
                  </Button>
                </div>

                <div data-testid="onb-s03-project-list" className="max-h-64 space-y-1 overflow-y-auto">
                  {previewQuery.data.projects.map((project) => (
                    <label
                      key={project.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"
                    >
                      <Checkbox
                        data-testid={`onb-s03-project-checkbox-${project.key}`}
                        checked={selectedProjects.has(project.key)}
                        onCheckedChange={() => toggleProject(project.key)}
                      />
                      <span className="font-mono text-sm">{project.key}</span>
                      <span className="text-sm">{project.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{project.issueCount} issues</span>
                    </label>
                  ))}
                </div>

                {/* Field Mapping Preview */}
                <div data-testid="onb-s03-field-mapping" className="rounded-md border border-border p-3">
                  <h3 className="mb-2 text-sm font-medium">Field Mapping</h3>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span>Jira Status → MnM Status</span>
                    <span>Jira Priority → MnM Priority</span>
                    <span>"To Do" → backlog</span>
                    <span>"High" → high</span>
                    <span>"In Progress" → in_progress</span>
                    <span>"Medium" → medium</span>
                    <span>"Done" → done</span>
                    <span>"Low" → low</span>
                  </div>
                  <p data-testid="onb-s03-dedup-indicator" className="mt-2 text-xs text-muted-foreground">
                    Deduplication: Issues with matching identifiers will be updated, not duplicated.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-between">
              <Button variant="outline" data-testid="onb-s03-back-step" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button
                data-testid="onb-s03-start-import"
                onClick={() => startMutation.mutate()}
                disabled={selectedProjects.size === 0 || startMutation.isPending}
              >
                {startMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Import ({selectedProjects.size} projects)
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Progress */}
        {step === 3 && activeJobQuery.data && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Import Progress</h2>
              <span
                data-testid="onb-s03-import-status"
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  activeJobQuery.data.status === "completed"
                    ? "bg-green-100 text-green-800"
                    : activeJobQuery.data.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : activeJobQuery.data.status === "cancelled"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                }`}
              >
                {activeJobQuery.data.status}
              </span>
            </div>

            <div data-testid="onb-s03-progress-bar" className="h-3 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${activeJobQuery.data.progressTotal > 0 ? (activeJobQuery.data.progressDone / activeJobQuery.data.progressTotal) * 100 : 0}%`,
                }}
              />
            </div>

            <p data-testid="onb-s03-progress-text" className="text-sm text-muted-foreground">
              {activeJobQuery.data.progressDone} / {activeJobQuery.data.progressTotal} issues imported
            </p>

            {activeJobQuery.data.status === "running" && (
              <Button
                variant="destructive"
                size="sm"
                data-testid="onb-s03-cancel-import"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                Cancel Import
              </Button>
            )}

            {activeJobQuery.data.errors.length > 0 && (
              <div data-testid="onb-s03-error-list" className="max-h-40 overflow-y-auto rounded-md border border-destructive/20 p-2">
                <h3 className="mb-1 text-sm font-medium text-destructive">Errors ({activeJobQuery.data.errors.length})</h3>
                {activeJobQuery.data.errors.map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <span className="font-mono">{err.issueKey}</span>: {err.message}
                  </p>
                ))}
              </div>
            )}

            {(activeJobQuery.data.status === "completed" || activeJobQuery.data.status === "failed" || activeJobQuery.data.status === "cancelled") && (
              <Button variant="outline" onClick={() => { setStep(1); setActiveJobId(null); setConnected(false); }}>
                New Import
              </Button>
            )}
          </div>
        )}

        {/* Import History */}
        {historyQuery.data && historyQuery.data.jobs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Import History</h2>
            <table data-testid="onb-s03-history-table" className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Progress</th>
                  <th className="pb-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.jobs.map((job) => (
                  <tr
                    key={job.jobId}
                    data-testid={`onb-s03-history-row-${job.jobId}`}
                    className="border-b"
                  >
                    <td className="py-2">{new Date(job.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          job.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : job.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {job.progressDone}/{job.progressTotal}
                    </td>
                    <td className="py-2">{job.errors.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
