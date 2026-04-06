import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";
import { blockPropsSchemas } from "@mnm/shared";

export const mnmCatalog = defineCatalog(schema, {
  components: {
    // Built-in shadcn from json-render
    Card: shadcnComponentDefinitions.Card,
    Stack: shadcnComponentDefinitions.Stack,
    Heading: shadcnComponentDefinitions.Heading,
    Button: shadcnComponentDefinitions.Button,
    Badge: shadcnComponentDefinitions.Badge,
    Separator: shadcnComponentDefinitions.Separator,

    // Custom MnM components
    MetricCard: blockPropsSchemas.MetricCard,
    StatusBadge: blockPropsSchemas.StatusBadge,
    DataTable: blockPropsSchemas.DataTable,
    CodeBlock: blockPropsSchemas.CodeBlock,
    ProgressBar: blockPropsSchemas.ProgressBar,
    Markdown: blockPropsSchemas.Markdown,
    Chart: blockPropsSchemas.Chart,
    ActionButton: blockPropsSchemas.ActionButton,
    QuickForm: blockPropsSchemas.QuickForm,
    Section: blockPropsSchemas.Section,
  },
  actions: {},
});
