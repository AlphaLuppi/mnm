import { DataTableProps } from "@mnm/shared";

const ALIGN: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };

export function MnmDataTable({ props }: { props: typeof DataTableProps._type }) {
  const rows = props.maxRows ? props.rows.slice(0, props.maxRows) : props.rows;

  return (
    <div className="space-y-2">
      {props.title && <h4 className="text-sm font-medium">{props.title}</h4>}
      <div className="overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {props.columns.map((col) => (
                <th key={col.key} className={`px-3 py-2 font-medium text-muted-foreground ${ALIGN[col.align ?? "left"]}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={props.columns.length} className="px-3 py-4 text-center text-muted-foreground">No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                {props.columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 ${ALIGN[col.align ?? "left"]}`}>
                    {String(row[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.maxRows && props.rows.length > props.maxRows && (
        <p className="text-xs text-muted-foreground">Showing {props.maxRows} of {props.rows.length} rows</p>
      )}
    </div>
  );
}
