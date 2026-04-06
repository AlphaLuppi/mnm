import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Star,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { ViewPreset, ViewPresetLayout, SidebarSection, DashboardWidget } from "@mnm/shared";
import { viewPresetsApi } from "../api/view-presets";
import { rolesApi, type Role } from "../api/roles";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { NAV_ITEM_REGISTRY } from "../lib/nav-registry";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#10b981", "#06b6d4", "#f59e0b", "#6366f1",
];

const LANDING_PAGES = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/issues", label: "Issues" },
  { value: "/inbox", label: "Inbox" },
  { value: "/chat", label: "Chat" },
  { value: "/goals", label: "Goals" },
  { value: "/projects", label: "Projects" },
  { value: "/agents", label: "Agents" },
];

interface ViewPresetEditorProps {
  preset: ViewPreset;
  onBack: () => void;
}

export function ViewPresetEditor({ preset, onBack }: ViewPresetEditorProps) {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState(preset.name);
  const [description, setDescription] = useState(preset.description ?? "");
  const [color, setColor] = useState(preset.color ?? "");
  const [isDefault, setIsDefault] = useState(preset.isDefault);
  const [layout, setLayout] = useState<ViewPresetLayout>(preset.layout);

  // Section expand state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    setBreadcrumbs([
      { label: "Admin" },
      { label: "View Presets" },
      { label: preset.name },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, preset.name]);

  // Roles query for assignment
  const { data: roles } = useQuery({
    queryKey: queryKeys.roles.list(selectedCompanyId!),
    queryFn: () => rolesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ViewPreset>) =>
      viewPresetsApi.update(selectedCompanyId!, preset.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.viewPresets.list(selectedCompanyId!),
      });
      pushToast({ title: "Preset saved", tone: "success" });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ roleId, viewPresetId }: { roleId: string; viewPresetId: string | null }) =>
      rolesApi.update(selectedCompanyId!, roleId, { viewPresetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.roles.list(selectedCompanyId!),
      });
      pushToast({ title: "Role updated", tone: "success" });
    },
  });

  function handleSave() {
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      color: color || null,
      isDefault,
      layout,
    } as Partial<ViewPreset>);
  }

  // Sidebar section helpers
  function toggleSectionExpand(idx: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleSidebarItem(sectionIdx: number, itemId: string) {
    setLayout((prev) => {
      const sections = [...prev.sidebar.sections];
      const section = { ...sections[sectionIdx] };
      const items = [...section.items];
      const idx = items.indexOf(itemId as any);
      if (idx >= 0) {
        items.splice(idx, 1);
      } else {
        items.push(itemId as any);
      }
      section.items = items;
      sections[sectionIdx] = section;
      return { ...prev, sidebar: { ...prev.sidebar, sections } };
    });
  }

  function moveSectionUp(idx: number) {
    if (idx === 0) return;
    setLayout((prev) => {
      const sections = [...prev.sidebar.sections];
      [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
      return { ...prev, sidebar: { ...prev.sidebar, sections } };
    });
  }

  function moveSectionDown(idx: number) {
    setLayout((prev) => {
      const sections = [...prev.sidebar.sections];
      if (idx >= sections.length - 1) return prev;
      [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
      return { ...prev, sidebar: { ...prev.sidebar, sections } };
    });
  }

  function addSidebarSection() {
    setLayout((prev) => ({
      ...prev,
      sidebar: {
        ...prev.sidebar,
        sections: [
          ...prev.sidebar.sections,
          { label: `Section ${prev.sidebar.sections.length + 1}`, items: [] },
        ],
      },
    }));
  }

  function removeSidebarSection(idx: number) {
    setLayout((prev) => {
      const sections = [...prev.sidebar.sections];
      sections.splice(idx, 1);
      return { ...prev, sidebar: { ...prev.sidebar, sections } };
    });
  }

  function updateSectionLabel(idx: number, label: string) {
    setLayout((prev) => {
      const sections = [...prev.sidebar.sections];
      sections[idx] = { ...sections[idx], label };
      return { ...prev, sidebar: { ...prev.sidebar, sections } };
    });
  }

  // Dashboard widget helpers
  function addWidget(type: string) {
    const def = WIDGET_REGISTRY[type];
    if (!def) return;
    setLayout((prev) => ({
      ...prev,
      dashboard: {
        ...prev.dashboard,
        widgets: [
          ...prev.dashboard.widgets,
          { type, span: def.defaultSpan },
        ],
      },
    }));
  }

  function removeWidget(idx: number) {
    setLayout((prev) => {
      const widgets = [...prev.dashboard.widgets];
      widgets.splice(idx, 1);
      return { ...prev, dashboard: { ...prev.dashboard, widgets } };
    });
  }

  function updateWidgetSpan(idx: number, span: 1 | 2 | 3 | 4) {
    setLayout((prev) => {
      const widgets = [...prev.dashboard.widgets];
      widgets[idx] = { ...widgets[idx], span };
      return { ...prev, dashboard: { ...prev.dashboard, widgets } };
    });
  }

  function moveWidgetUp(idx: number) {
    if (idx === 0) return;
    setLayout((prev) => {
      const widgets = [...prev.dashboard.widgets];
      [widgets[idx - 1], widgets[idx]] = [widgets[idx], widgets[idx - 1]];
      return { ...prev, dashboard: { ...prev.dashboard, widgets } };
    });
  }

  function moveWidgetDown(idx: number) {
    setLayout((prev) => {
      const widgets = [...prev.dashboard.widgets];
      if (idx >= widgets.length - 1) return prev;
      [widgets[idx], widgets[idx + 1]] = [widgets[idx + 1], widgets[idx]];
      return { ...prev, dashboard: { ...prev.dashboard, widgets } };
    });
  }

  // All nav item IDs for sidebar item checkboxes
  const allNavItems = Object.entries(NAV_ITEM_REGISTRY).map(([id, def]) => ({
    id,
    label: def.label,
  }));

  // Already-used widget types
  const usedWidgetTypes = new Set(layout.dashboard.widgets.map((w) => w.type));
  const availableWidgets = Object.entries(WIDGET_REGISTRY)
    .filter(([type]) => !usedWidgetTypes.has(type))
    .map(([type, def]) => ({ type, label: def.label }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Edit: {preset.name}</h1>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending || !name.trim()}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      {saveMutation.error && (
        <p className="text-xs text-destructive">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "Failed to save preset"}
        </p>
      )}

      {/* General */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={preset.slug} disabled />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label>Color</Label>
            <div className="flex items-center gap-2 mt-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded-full transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              {color && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setColor("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-default"
              checked={isDefault}
              onCheckedChange={(val) => setIsDefault(val === true)}
            />
            <Label htmlFor="edit-default" className="cursor-pointer">
              Default preset
            </Label>
          </div>
        </div>
      </section>

      {/* Sidebar Sections */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Sidebar Sections
          </h2>
          <Button variant="outline" size="sm" onClick={addSidebarSection}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Section
          </Button>
        </div>

        {layout.sidebar.sections.map((section, sIdx) => (
          <div key={sIdx} className="border border-border/50 rounded-md">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-foreground flex-1 text-left"
                onClick={() => toggleSectionExpand(sIdx)}
              >
                {expandedSections.has(sIdx) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <Input
                  value={section.label}
                  onChange={(e) => updateSectionLabel(sIdx, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-xs py-0 px-1 w-40"
                  placeholder="Section label"
                />
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                  {section.items.length}
                </Badge>
              </button>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveSectionUp(sIdx)}
                  disabled={sIdx === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveSectionDown(sIdx)}
                  disabled={sIdx === layout.sidebar.sections.length - 1}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeSidebarSection(sIdx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {expandedSections.has(sIdx) && (
              <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {allNavItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-1.5 text-xs cursor-pointer hover:text-foreground"
                  >
                    <Checkbox
                      checked={section.items.includes(item.id as any)}
                      onCheckedChange={() => toggleSidebarItem(sIdx, item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Dashboard Widgets */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Dashboard Widgets
          </h2>
          {availableWidgets.length > 0 && (
            <Select onValueChange={(type) => addWidget(type)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="+ Add Widget" />
              </SelectTrigger>
              <SelectContent>
                {availableWidgets.map((w) => (
                  <SelectItem key={w.type} value={w.type}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {layout.dashboard.widgets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No widgets configured.</p>
        ) : (
          <div className="space-y-1.5">
            {layout.dashboard.widgets.map((widget, wIdx) => {
              const def = WIDGET_REGISTRY[widget.type];
              return (
                <div
                  key={`${widget.type}-${wIdx}`}
                  className="flex items-center gap-2 px-3 py-2 border border-border/50 rounded-md"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium flex-1">
                    {def?.label ?? widget.type}
                  </span>
                  <Select
                    value={String(widget.span ?? def?.defaultSpan ?? 2)}
                    onValueChange={(val) => updateWidgetSpan(wIdx, parseInt(val) as 1 | 2 | 3 | 4)}
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Span 1</SelectItem>
                      <SelectItem value="2">Span 2</SelectItem>
                      <SelectItem value="3">Span 3</SelectItem>
                      <SelectItem value="4">Span 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveWidgetUp(wIdx)}
                      disabled={wIdx === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => moveWidgetDown(wIdx)}
                      disabled={wIdx === layout.dashboard.widgets.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeWidget(wIdx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Landing Page */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Landing Page
        </h2>
        <p className="text-xs text-muted-foreground">Redirect after login to:</p>
        <div className="flex flex-wrap gap-3">
          {LANDING_PAGES.map((page) => (
            <label key={page.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="landing-page"
                checked={layout.landingPage === page.value}
                onChange={() =>
                  setLayout((prev) => ({ ...prev, landingPage: page.value }))
                }
                className="accent-primary"
              />
              {page.label}
            </label>
          ))}
        </div>
      </section>

      {/* Role Assignment */}
      <section className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Role Assignment
        </h2>
        <p className="text-xs text-muted-foreground">
          Assign this preset to roles. Users with the role will see this view.
        </p>

        {!roles || roles.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No roles found.</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Current Preset</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const isAssigned = role.viewPresetId === preset.id;
                  return (
                    <tr
                      key={role.id}
                      className="border-b border-border last:border-b-0 hover:bg-accent/30"
                    >
                      <td className="px-3 py-2 font-medium">{role.name}</td>
                      <td className="px-3 py-2 hidden sm:table-cell text-muted-foreground">
                        {isAssigned ? (
                          <Badge variant="secondary">{preset.name}</Badge>
                        ) : role.viewPresetId ? (
                          <span>Other preset</span>
                        ) : (
                          <span className="italic">(none)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isAssigned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              assignRoleMutation.mutate({
                                roleId: role.id,
                                viewPresetId: null,
                              })
                            }
                            disabled={assignRoleMutation.isPending}
                          >
                            Unassign
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              assignRoleMutation.mutate({
                                roleId: role.id,
                                viewPresetId: preset.id,
                              })
                            }
                            disabled={assignRoleMutation.isPending}
                          >
                            Assign this
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
