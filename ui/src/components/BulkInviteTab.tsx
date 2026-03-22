import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, AlertCircle, CheckCircle2, XCircle, FileText } from "lucide-react";
import { accessApi } from "../api/access";
import { RoleBadge } from "./RoleBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkInviteTabProps {
  companyId: string;
  onComplete: () => void;
}

type CsvRow = {
  line: number;
  email: string;
  role: string;
  validationError: string | null;
};

type InviteResult = CsvRow & {
  status: "success" | "error" | "skipped";
  errorMessage?: string;
};

type BulkPhase = "idle" | "preview" | "sending" | "results";

// ---------------------------------------------------------------------------
// CSV Parsing & Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCEPTED_TYPES = new Set([
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);

function parseCSV(text: string): { email: string; role: string }[] {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) return [];

  // Detect separator (, or ;)
  const separator = lines[0].includes(";") ? ";" : ",";

  // Check for header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const parts = line.split(separator).map((s) => s.trim().replace(/^["']|["']$/g, ""));
    return {
      email: (parts[0] || "").trim().toLowerCase(),
      role: (parts[1] || "contributor").trim().toLowerCase(),
    };
  });
}

function validateRows(parsed: { email: string; role: string }[]): CsvRow[] {
  const seenEmails = new Set<string>();
  return parsed.map((row, index) => {
    const line = index + 1;
    let validationError: string | null = null;

    if (!row.email) {
      validationError = "Email is required";
    } else if (row.email.length > 320) {
      validationError = "Email exceeds maximum length (320 chars)";
    } else if (!EMAIL_RE.test(row.email)) {
      validationError = "Invalid email format";
    } else if (!VALID_ROLES.includes(row.role)) {
    } else if (seenEmails.has(row.email)) {
      validationError = "Duplicate email in CSV";
    }

    if (!validationError) {
      seenEmails.add(row.email);
    }

    return { line, email: row.email, role: row.role, validationError };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkInviteTab({ companyId, onComplete }: BulkInviteTabProps) {
  const [phase, setPhase] = useState<BulkPhase>("idle");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [results, setResults] = useState<InviteResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const abortRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- File handling --------------------------------------------------------

  const processFile = useCallback((file: File) => {
    setFileError(null);

    // Validate type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.has(file.type) && ext !== "csv" && ext !== "txt") {
      setFileError("Please upload a CSV file (.csv or .txt)");
      return;
    }

    // Validate size (1 MB)
    if (file.size > 1_048_576) {
      setFileError("File is too large. Maximum size is 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        // Check if there was a header-only file
        const clean = text.replace(/^\uFEFF/, "");
        const lines = clean.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length === 1 && lines[0].toLowerCase().includes("email")) {
          setFileError("File contains only a header row with no data");
        } else {
          setFileError("File is empty or contains no data rows");
        }
        return;
      }

      if (parsed.length > 100) {
        setFileError("Too many rows. Maximum is 100 rows per import.");
        return;
      }

      const validated = validateRows(parsed);
      setRows(validated);
      setFileName(file.name);
      setPhase("preview");
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [processFile],
  );

  // -- Sending --------------------------------------------------------------

  const validRows = rows.filter((r) => !r.validationError);
  const invalidRows = rows.filter((r) => !!r.validationError);

  const handleSend = useCallback(async () => {
    abortRef.current = false;
    setCancelled(false);
    setPhase("sending");

    const total = validRows.length;
    setProgress({ current: 0, total });

    const allResults: InviteResult[] = [];

    // First, add all invalid rows as skipped
    for (const row of invalidRows) {
      allResults.push({
        ...row,
        status: "skipped",
        errorMessage: row.validationError ?? undefined,
      });
    }

    // Process valid rows sequentially
    for (let i = 0; i < validRows.length; i++) {
      if (abortRef.current) {
        // Mark remaining as skipped
        for (let j = i; j < validRows.length; j++) {
          allResults.push({
            ...validRows[j],
            status: "skipped",
            errorMessage: "Import cancelled",
          });
        }
        break;
      }

      const row = validRows[i];
      setProgress({ current: i + 1, total });

      try {
        await accessApi.createEmailInvite(companyId, row.email);
        allResults.push({ ...row, status: "success" });
      } catch (err: unknown) {
        let errorMessage = "Unexpected error";
        if (err && typeof err === "object" && "status" in err) {
          const status = (err as { status?: number }).status;
          if (status === 409) {
            errorMessage = "Invitation already exists for this email";
          } else if (status === 403) {
            errorMessage = "Permission denied";
          } else if (status === 400) {
            errorMessage =
              (err as { message?: string }).message ?? "Bad request";
          } else if (status === 401) {
            errorMessage = "Session expired, please log in again";
          }
        } else if (err instanceof Error) {
          if (err.message.includes("409") || err.message.toLowerCase().includes("conflict")) {
            errorMessage = "Invitation already exists for this email";
          } else if (err.message.includes("403")) {
            errorMessage = "Permission denied";
          } else if (err.message.includes("Network") || err.message.includes("fetch")) {
            errorMessage = "Network error";
          } else {
            errorMessage = err.message;
          }
        }
        allResults.push({ ...row, status: "error", errorMessage });
      }
    }

    // Sort results by line number for display
    allResults.sort((a, b) => a.line - b.line);
    setResults(allResults);
    if (abortRef.current) setCancelled(true);
    setPhase("results");
  }, [companyId, validRows, invalidRows]);

  const handleCancelImport = useCallback(() => {
    abortRef.current = true;
  }, []);

  const handleChangeFile = useCallback(() => {
    setPhase("idle");
    setRows([]);
    setResults([]);
    setFileName(null);
    setFileError(null);
  }, []);

  // -- Render per phase -----------------------------------------------------

  if (phase === "idle") {
    return (
      <div className="space-y-3">
        <div
          data-testid="mu-s03-dropzone"
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            data-testid="mu-s03-file-input"
            type="file"
            accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium mb-1">
            Drag & drop a CSV file or click to browse
          </p>
          <div
            data-testid="mu-s03-format-hint"
            className="text-xs text-muted-foreground font-mono bg-muted/50 rounded p-2 mt-3 inline-block text-left"
          >
            <p className="mb-1">Expected format:</p>
            <p>email,role</p>
            <p>john@example.com,contributor</p>
            <p>jane@example.com,admin</p>
          </div>
          <div className="mt-3">
            <Button
              data-testid="mu-s03-browse-button"
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse Files
            </Button>
          </div>
        </div>

        {fileError && (
          <div
            data-testid="mu-s03-file-error"
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fileError}
          </div>
        )}
      </div>
    );
  }

  if (phase === "preview") {
    const errorCount = invalidRows.length;
    const validCount = validRows.length;

    return (
      <div className="space-y-3">
        {/* File info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span data-testid="mu-s03-file-name" className="font-medium">
              {fileName}
            </span>
            <span
              data-testid="mu-s03-row-count"
              className="text-muted-foreground"
            >
              &mdash; {rows.length} rows parsed
            </span>
          </div>
          <Button
            data-testid="mu-s03-change-file"
            variant="ghost"
            size="sm"
            onClick={handleChangeFile}
          >
            Change File
          </Button>
        </div>

        {/* Preview table */}
        <div className="border border-border rounded-md overflow-hidden max-h-[280px] overflow-y-auto">
          <table
            data-testid="mu-s03-preview-table"
            className="w-full text-sm"
          >
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">
                  #
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">
                  Role
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-10">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.line}
                  data-testid={`mu-s03-preview-row-${row.line}`}
                  className={`border-b border-border last:border-b-0 ${
                    row.validationError ? "bg-destructive/5" : ""
                  }`}
                >
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {row.line}
                  </td>
                  <td
                    data-testid={`mu-s03-preview-email-${row.line}`}
                    className="px-3 py-1.5 font-mono text-xs truncate max-w-[200px]"
                  >
                    {row.email || <span className="text-muted-foreground italic">empty</span>}
                  </td>
                  <td
                    data-testid={`mu-s03-preview-role-${row.line}`}
                    className="px-3 py-1.5"
                  >
                    {VALID_ROLES.includes(row.role)
                      ? <RoleBadge role={row.role as string} />
                      : row.role || "contributor"}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {row.validationError ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            data-testid={`mu-s03-preview-error-${row.line}`}
                          >
                            <AlertCircle className="h-4 w-4 text-destructive inline" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.validationError}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Error count */}
        {errorCount > 0 && (
          <p
            data-testid="mu-s03-error-count"
            className="text-sm text-destructive"
          >
            {errorCount} error{errorCount > 1 ? "s" : ""} found. Fix errors or
            they will be skipped during import.
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            data-testid="mu-s03-cancel-button"
            variant="outline"
            onClick={onComplete}
          >
            Cancel
          </Button>
          <Button
            data-testid="mu-s03-send-button"
            disabled={validCount === 0}
            onClick={handleSend}
          >
            Send {validCount} Invitation{validCount !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "sending") {
    const pct =
      progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;
    const currentEmail =
      validRows[progress.current - 1]?.email ?? "";

    return (
      <div className="space-y-4 py-4">
        <p className="text-sm font-medium">Sending invitations...</p>

        {/* Progress bar */}
        <div className="space-y-1">
          <div
            data-testid="mu-s03-progress-bar"
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
          >
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            data-testid="mu-s03-progress-text"
            className="text-xs text-muted-foreground"
          >
            {progress.current}/{progress.total} sent
          </p>
        </div>

        {/* Current email */}
        {currentEmail && (
          <p
            data-testid="mu-s03-current-email"
            className="text-xs text-muted-foreground"
          >
            Currently sending: {currentEmail}
          </p>
        )}

        {/* Cancel */}
        <div className="flex justify-end">
          <Button
            data-testid="mu-s03-cancel-import"
            variant="outline"
            onClick={handleCancelImport}
          >
            Cancel Import
          </Button>
        </div>
      </div>
    );
  }

  // phase === "results"
  const sentCount = results.filter((r) => r.status === "success").length;
  const failedCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return (
    <div className="space-y-3">
      <p
        data-testid="mu-s03-results-title"
        className="text-sm font-medium"
      >
        {cancelled ? "Import Cancelled" : "Import Complete"}
      </p>

      <p
        data-testid="mu-s03-results-summary"
        className="text-sm text-muted-foreground"
      >
        {sentCount} sent / {failedCount} failed / {skippedCount} skipped
      </p>

      {/* Results table */}
      <div className="border border-border rounded-md overflow-hidden max-h-[280px] overflow-y-auto">
        <table
          data-testid="mu-s03-results-table"
          className="w-full text-sm"
        >
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10">
                #
              </th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                Email
              </th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">
                Role
              </th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr
                key={row.line}
                data-testid={`mu-s03-result-row-${row.line}`}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-1.5 text-muted-foreground">
                  {row.line}
                </td>
                <td
                  data-testid={`mu-s03-result-email-${row.line}`}
                  className="px-3 py-1.5 font-mono text-xs truncate max-w-[200px]"
                >
                  {row.email || <span className="text-muted-foreground italic">empty</span>}
                </td>
                <td
                  data-testid={`mu-s03-result-role-${row.line}`}
                  className="px-3 py-1.5"
                >
                  {VALID_ROLES.includes(row.role)
                    ? <RoleBadge role={row.role as string} />
                    : row.role || "contributor"}
                </td>
                <td className="px-3 py-1.5">
                  {row.status === "success" && (
                    <Badge
                      data-testid={`mu-s03-result-status-${row.line}`}
                      variant="secondary"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Sent
                    </Badge>
                  )}
                  {row.status === "error" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          data-testid={`mu-s03-result-status-${row.line}`}
                          variant="destructive"
                        >
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.errorMessage ?? "Unknown error"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {row.status === "skipped" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          data-testid={`mu-s03-result-status-${row.line}`}
                          variant="outline"
                        >
                          Skipped
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.errorMessage ?? "Skipped"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Done */}
      <div className="flex justify-end pt-1">
        <Button
          data-testid="mu-s03-done-button"
          onClick={onComplete}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
