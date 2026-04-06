import { z } from "zod";

const widgetPlacementSchema = z.object({
  widgetId: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(8),
  hidden: z.boolean().optional(),
  props: z.record(z.unknown()).optional(),
});

export const layoutOverridesV2Schema = z.object({
  landingPage: z.string().min(1).optional(),
  sidebar: z.object({
    pinnedItems: z.array(z.string()).optional(),
    hiddenItems: z.array(z.string()).optional(),
    sectionOrder: z.array(z.string()).optional(),
  }).optional(),
  dashboard: z.object({
    hiddenWidgets: z.array(z.string()).optional(),
    extraWidgets: z.array(z.object({
      type: z.string().min(1),
      span: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
      props: z.record(z.unknown()).optional(),
    })).optional(),
    layout: z.array(widgetPlacementSchema).optional(),
  }).optional(),
});

export type LayoutOverridesV2 = z.infer<typeof layoutOverridesV2Schema>;
