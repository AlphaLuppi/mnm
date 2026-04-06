import { useState } from "react";
import type { QuickFormBlock as QuickFormBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickFormBlock({ block, context }: { block: QuickFormBlockType; context: BlockContext }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of block.fields) {
      init[field.name] = field.defaultValue ?? (field.type === "checkbox" ? false : "");
    }
    return init;
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  function setValue(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: false }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    for (const field of block.fields) {
      if (field.required) {
        const val = values[field.name];
        if (val === "" || val === undefined || val === null) {
          newErrors[field.name] = true;
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await context.onAction(block.submitAction, {
        ...block.submitPayload,
        formData: values,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border rounded-md p-3">
      {block.title && <p className="text-sm font-semibold text-foreground">{block.title}</p>}
      {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}

      <div className="space-y-3">
        {block.fields.map((field) => (
          <div key={field.name} className="space-y-1.5">
            {field.type !== "checkbox" && (
              <Label htmlFor={`qf-${field.name}`}>
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
            )}

            {field.type === "text" && (
              <Input
                id={`qf-${field.name}`}
                value={values[field.name] as string}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitting}
                className={errors[field.name] ? "border-destructive" : ""}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                id={`qf-${field.name}`}
                value={values[field.name] as string}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitting}
                rows={3}
                className={errors[field.name] ? "border-destructive" : ""}
              />
            )}

            {field.type === "number" && (
              <Input
                id={`qf-${field.name}`}
                type="number"
                value={values[field.name] as string}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitting}
                className={errors[field.name] ? "border-destructive" : ""}
              />
            )}

            {field.type === "date" && (
              <Input
                id={`qf-${field.name}`}
                type="date"
                value={values[field.name] as string}
                onChange={(e) => setValue(field.name, e.target.value)}
                disabled={submitting}
                className={errors[field.name] ? "border-destructive" : ""}
              />
            )}

            {field.type === "select" && field.options && (
              <Select
                value={values[field.name] as string}
                onValueChange={(v) => setValue(field.name, v)}
                disabled={submitting}
              >
                <SelectTrigger
                  id={`qf-${field.name}`}
                  className={errors[field.name] ? "border-destructive" : ""}
                >
                  <SelectValue placeholder={field.placeholder ?? "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === "checkbox" && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`qf-${field.name}`}
                  checked={!!values[field.name]}
                  onCheckedChange={(v) => setValue(field.name, v)}
                  disabled={submitting}
                />
                <Label htmlFor={`qf-${field.name}`} className="text-sm font-normal">
                  {field.label}
                  {field.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
              </div>
            )}

            {errors[field.name] && (
              <p className="text-xs text-destructive mt-1">Required</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Submitting..." : block.submitLabel ?? "Submit"}
        </Button>
      </div>
    </form>
  );
}
