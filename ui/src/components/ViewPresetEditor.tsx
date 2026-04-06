import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type {
  ViewPreset,
  ViewPresetLayout,
  SidebarSection,
  NavItemId,
  DashboardWidget,
} from "@mnm/shared";
import { DEFAULT_LAYOUT } from "@mnm/shared";
import { NAV_ITEM_REGISTRY } from "../lib/nav-registry";
import { WIDGET_REGISTRY } from "../lib/widget-registry";
import { viewPresetsApi } from "../api/view-presets";
import { rolesApi, type Role } from "../api/roles";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

const ALL_NAV_ITEMS = Object.keys(NAV_ITEM_REGISTRY) as NavItemId[];
const ALL_WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);

interface ViewPresetEditorProps {
  preset: ViewPreset | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  isDefault: boolean;
  layout: ViewPresetLayout;
}

function presetToForm(preset: ViewPreset | null): FormState {
  if (!preset) {
    return {
      name: "",
      slug: "",
      description: "",
      icon: "",
      color: PRESET_COLORS[0],
      isDefault: false,
      layout: structuredClone(DEFAULT_LAYOUT),
    };
  }
  return {
    name: preset.name,
    slug: preset.slug,
    description: preset.description ?? "",
    icon: preset.icon ?? "",
    color: preset.color ?? PRESET_COLORS[0],
    isDefault: preset.isDefault,
    layout: structuredClone(preset.layout),
  };
}

export function ViewPresetEditor({ preset, open, onClose, onSaved }: ViewPresetEditorProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const isEditing = !!preset;

  const [form, setForm] = useState<FormState>(() => presetToForm(preset));
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  // Roles query for assignment section
  const { data: roles } = useQuery({
    queryKey: queryKeys.roles.list(selectedCompanyId!),
    queryFn: () => rolesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ViewPreset>) =>
      viewPresetsApi.create(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.viewPresets.list(selectedCompanyId!) });
      onSaved();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ViewPreset>) =>
      viewPresetsApi.update(selectedCompanyId!, preset!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.viewPresets.list(selectedCompanyId!) });
      onSaved();
    },
  });

  // Role preset assignment mutation
  const assignRoleMutation = useMutation({
    mutationFn: ({ roleId, viewPresetId }: { roleId: string; viewPresetId: string | null }) =>
      rolesApi.update(selectedCompanyId!, roleId, { viewPresetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.list(selectedCompanyId!) });
    },
  });

  const saveMutation = isEditing ? updateMutation : createMutation;

  function handleSave() {
    const data: Partial<ViewPreset> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      color: form.color || null,
      isDefault: form.isDefault,
      layout: form.layout,
    };
    saveMutation.mutate(data);
  }

  function handleSlugFromName(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug && isEditing
        ? prev.slug
        : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    }));
  }

  // ── Sidebar section helpers ──

  function toggleSectionExpanded(idx: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function addSection() {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        sidebar: {
          ...prev.layout.sidebar,
          sections: [...prev.layout.sidebar.sections, { label: "New Section", items: [] }],
        },
      },
    }));
  }

  function removeSection(idx: number) {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        sidebar: {
          ...prev.layout.sidebar,
          sections: prev.layout.sidebar.sections.filter((_, i) => i !== idx),
        },
      },
    }));
  }

  function renameSectionLabel(idx: number, label: string) {
    setForm((prev) => {
      const sections = [...prev.layout.sidebar.sections];
      sections[idx] = { ...sections[idx], label };
      return { ...prev, layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, sections } } };
    });
  }

  function moveSectionUp(idx: number) {
    if (idx === 0) return;
    setForm((prev) => {
      const sections = [...prev.layout.sidebar.sections];
      [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
      return { ...prev, layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, sections } } };
    });
  }

  function moveSectionDown(idx: number) {
    setForm((prev) => {
      const sections = [...prev.layout.sidebar.sections];
      if (idx >= sections.length - 1) return prev;
      [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
      return { ...prev, layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, sections } } };
    });
  }

  function toggleNavItem(sectionIdx: number, itemId: NavItemId) {
    setForm((prev) => {
      const sections = [...prev.layout.sidebar.sections];
      const section = { ...sections[sectionIdx] };
      if (section.items.includes(itemId)) {
        section.items = section.items.filter((id) => id !== itemId);
      } else {
        section.items = [...section.items, itemId];
      }
      sections[sectionIdx] = section;
      return { ...prev, layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, sections } } };
    });
  }

  // ── Widget helpers ──

  function addWidget(type: string) {
    const def = WIDGET_REGISTRY[type];
    const widget: DashboardWidget = { type, span: def?.defaultSpan ?? 2 };
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        dashboard: {
          ...prev.layout.dashboard,
          widgets: [...prev.layout.dashboard.widgets, widget],
        },
      },
    }));
  }

  function removeWidget(idx: number) {
    setForm((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        dashboard: {
          ...prev.layout.dashboard,
          widgets: prev.layout.dashboard.widgets.filter((_, i) => i !== idx),
        },
      },
    }));
  }

  function moveWidgetUp(idx: number) {
    if (idx === 0) return;
    setForm((prev) => {
      const widgets = [...prev.layout.dashboard.widgets];
      [widgets[idx - 1], widgets[idx]] = [widgets[idx], widgets[idx - 1]];
      return { ...prev, layout: { ...prev.layout, dashboard: { ...prev.layout.dashboard, widgets } } };
    });
  }

  function moveWidgetDown(idx: number) {
    setForm((prev) => {
      const widgets = [...prev.layout.dashboard.widgets];
      if (idx >= widgets.length - 1) return prev;
      [widgets[idx], widgets[idx + 1]] = [widgets[idx + 1], widgets[idx]];
      return { ...prev, layout: { ...prev.layout, dashboard: { ...prev.layout.dashboard, widgets } } };
    });
  }

  function setWidgetSpan(idx: number, span: 1 | 2 | 3 | 4) {
    setForm((prev) => {
      const widgets = [...prev.layout.dashboard.widgets];
      widgets[idx] = { ...widgets[idx], span };
      return { ...prev, layout: { ...prev.layout, dashboard: { ...prev.layout.dashboard, widgets } } };
    });
  }

  // Compute which nav items are used in any section (for showing "available" items per section)
  const usedNavItems = new Set(form.layout.sidebar.sections.flatMap((s) => s.items));

  // Available widget types (not already in the list)
  const usedWidgetTypes = new Set(form.layout.dashboard.widgets.map((w) => w.type));
  const availableWidgets = ALL_WIDGET_TYPES.filter((t) => !usedWidgetTypes.has(t));

  // Available landing pages from the nav items in the sidebar
  const landingPageOptions = form.layout.sidebar.sections
    .flatMap((s) => s.items)
    .filter((id) => NAV_ITEM_REGISTRY[id])
    .map((id) => ({ id, label: NAV_ITEM_REGISTRY[id].label, to: NAV_ITEM_REGISTRY[id].to }));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? `Edit: ${preset.name}` : "Create View Preset"}</SheetTitle>
          <SheetDescription>
            Configure the sidebar navigation, dashboard widgets, and landing page for this view preset.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-6">
          {/* ── General ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="vp-name">Name</Label>
                <Input
                  id="vp-name"
                  placeholder="e.g. Product Manager"
                  value={form.name}
                  onChange={(e) => handleSlugFromName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="vp-slug">Slug</Label>
                <Input
                  id="vp-slug"
                  placeholder="e.g. product-manager"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  disabled={isEditing}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="vp-desc">Description</Label>
              <Textarea
                id="vp-desc"
                placeholder="Optional description..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <Label>Color</Label>
                <div className="flex gap-1.5 mt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-7 h-7 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? "white" : "transparent",
                        transform: form.color === c ? "scale(1.15)" : "scale(1)",
                      }}
                      onClick={() => setForm((prev) => ({ ...prev, color: c }))}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isDefault: checked }))}
                />
                <Label className="text-sm cursor-pointer">Default preset</Label>
              </div>
            </div>
          </section>

          {/* ── Sidebar Sections ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sidebar Sections</h3>
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Section
              </Button>
            </div>

            <div className="space-y-2">
              {form.layout.sidebar.sections.map((section, sIdx) => (
                <div key={sIdx} className="border border-border rounded-md">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => toggleSectionExpanded(sIdx)}
                    >
                      {expandedSections.has(sIdx) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <Input
                      className="h-7 text-xs flex-1"
                      value={section.label}
                      onChange={(e) => renameSectionLabel(sIdx, e.target.value)}
                      placeholder="Section name"
                    />
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                      {section.items.length}
                    </Badge>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => moveSectionUp(sIdx)} disabled={sIdx === 0}>
                        <span className="text-xs">^</span>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => moveSectionDown(sIdx)} disabled={sIdx === form.layout.sidebar.sections.length - 1}>
                        <span className="text-xs">v</span>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeSection(sIdx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {expandedSections.has(sIdx) && (
                    <div className="px-3 pb-2 pt-1 space-y-1">
                      {ALL_NAV_ITEMS.map((itemId) => {
                        const def = NAV_ITEM_REGISTRY[itemId];
                        const isInThisSection = section.items.includes(itemId);
                        const isInOtherSection = !isInThisSection && usedNavItems.has(itemId);
                        return (
                          <label
                            key={itemId}
                            className={`flex items-center gap-2 text-xs cursor-pointer hover:text-foreground ${isInOtherSection ? "opacity-40" : ""}`}
                          >
                            <Checkbox
                              checked={isInThisSection}
                              onCheckedChange={() => toggleNavItem(sIdx, itemId)}
                              disabled={isInOtherSection}
                            />
                            <def.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{def.label}</span>
                            <code className="text-[10px] text-muted-foreground">{itemId}</code>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={form.layout.sidebar.showProjects ?? true}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, showProjects: !!checked } },
                    }))
                  }
                />
                Show Projects
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={form.layout.sidebar.showAgents ?? true}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      layout: { ...prev.layout, sidebar: { ...prev.layout.sidebar, showAgents: !!checked } },
                    }))
                  }
                />
                Show Agents
              </label>
            </div>
          </section>

          {/* ── Dashboard Widgets ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dashboard Widgets</h3>
            </div>

            <div className="space-y-1">
              {form.layout.dashboard.widgets.map((widget, wIdx) => {
                const def = WIDGET_REGISTRY[widget.type];
                return (
                  <div key={wIdx} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium flex-1">{def?.label ?? widget.type}</span>
                    <Select
                      value={String(widget.span ?? def?.defaultSpan ?? 2)}
                      onValueChange={(v) => setWidgetSpan(wIdx, parseInt(v) as 1 | 2 | 3 | 4)}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Span 1</SelectItem>
                        <SelectItem value="2">Span 2</SelectItem>
                        <SelectItem value="3">Span 3</SelectItem>
                        <SelectItem value="4">Span 4</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={() => moveWidgetUp(wIdx)} disabled={wIdx === 0}>
                        <span className="text-xs">^</span>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => moveWidgetDown(wIdx)} disabled={wIdx === form.layout.dashboard.widgets.length - 1}>
                        <span className="text-xs">v</span>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeWidget(wIdx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {availableWidgets.length > 0 && (
              <Select onValueChange={(v) => addWidget(v)}>
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue placeholder="+ Add Widget..." />
                </SelectTrigger>
                <SelectContent>
                  {availableWidgets.map((type) => (
                    <SelectItem key={type} value={type}>
                      {WIDGET_REGISTRY[type].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>

          {/* ── Landing Page ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Landing Page</h3>
            <p className="text-xs text-muted-foreground">Redirect users to this page after login.</p>
            <Select
              value={form.layout.landingPage}
              onValueChange={(v) => setForm((prev) => ({
                ...prev,
                layout: { ...prev.layout, landingPage: v },
              }))}
            >
              <SelectTrigger className="h-9 text-sm w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {landingPageOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.to}>
                    {opt.label} ({opt.to})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* ── Role Assignment (F1-ADMIN-03) ── */}
          {isEditing && roles && roles.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Role Assignment</h3>
              <p className="text-xs text-muted-foreground">
                Assign this preset to roles. Users with that role will see this layout.
              </p>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Role</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Current Preset</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role: Role) => {
                      const isAssigned = role.viewPresetId === preset.id;
                      return (
                        <tr key={role.id} className="border-b border-border last:border-b-0 hover:bg-accent/30">
                          <td className="px-3 py-2 text-xs font-medium">{role.name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {isAssigned ? (
                              <Badge variant="secondary" className="text-[10px]">This preset</Badge>
                            ) : role.viewPresetId ? (
                              <span className="text-muted-foreground">Other</span>
                            ) : (
                              <span className="text-muted-foreground/50">None</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isAssigned ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px]"
                                onClick={() => assignRoleMutation.mutate({ roleId: role.id, viewPresetId: null })}
                                disabled={assignRoleMutation.isPending}
                              >
                                Unassign
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px]"
                                onClick={() => assignRoleMutation.mutate({ roleId: role.id, viewPresetId: preset.id })}
                                disabled={assignRoleMutation.isPending}
                              >
                                Assign
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Save ── */}
          {saveMutation.error && (
            <p className="text-xs text-destructive">
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : "Failed to save preset"}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.slug.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
