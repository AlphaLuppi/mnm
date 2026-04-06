import { useState } from "react";
import { QuickFormProps } from "@mnm/shared";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2 } from "lucide-react";


export function MnmQuickForm({ props }: { props: typeof QuickFormProps._type }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of props.fields) {
      init[f.name] = f.defaultValue ?? (f.type === "checkbox" ? false : "");
    }
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setValue = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const event = new CustomEvent("mnm-block-action", {
        bubbles: true,
        detail: { action: props.submitAction, payload: { ...props.submitPayload, formData: values } },
      });
      document.dispatchEvent(event);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm text-emerald-800 dark:text-emerald-300">
        Response submitted
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      {props.title && <h4 className="text-sm font-medium">{props.title}</h4>}
      {props.description && <p className="text-xs text-muted-foreground">{props.description}</p>}

      {props.fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label className="text-xs">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
          {field.type === "text" && (
            <Input size={1} placeholder={field.placeholder} value={String(values[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value)} required={field.required} />
          )}
          {field.type === "number" && (
            <Input type="number" placeholder={field.placeholder} value={String(values[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value)} required={field.required} />
          )}
          {field.type === "date" && (
            <Input type="date" value={String(values[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value)} required={field.required} />
          )}
          {field.type === "textarea" && (
            <Textarea placeholder={field.placeholder} value={String(values[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value)} required={field.required} rows={3} />
          )}
          {field.type === "select" && field.options && (
            <Select value={String(values[field.name] ?? "")} onValueChange={(v) => setValue(field.name, v)}>
              <SelectTrigger><SelectValue placeholder={field.placeholder ?? "Select..."} /></SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {field.type === "checkbox" && (
            <div className="flex items-center gap-2">
              <Checkbox checked={Boolean(values[field.name])} onCheckedChange={(v) => setValue(field.name, v)} />
              <span className="text-xs text-muted-foreground">{field.placeholder}</span>
            </div>
          )}
        </div>
      ))}

      <Button type="submit" size="sm" disabled={loading}>
        {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {props.submitLabel ?? "Submit"}
      </Button>
    </form>
  );
}
