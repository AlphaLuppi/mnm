import type { DataTableBlock as DataTableBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";

export function DataTableBlock({ block }: { block: DataTableBlockType; context: BlockContext }) {
  const displayRows = block.maxRows
    ? block.rows.slice(0, block.maxRows)
    : block.rows;
  const hiddenCount = block.maxRows
    ? Math.max(0, block.rows.length - block.maxRows)
    : 0;

  return (
    <div className="w-full">
      {block.title && (
        <p className="text-sm font-medium text-foreground mb-2">{block.title}</p>
      )}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {block.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                    col.align === "center"
                      ? "text-center"
                      : col.align === "right"
                        ? "text-right"
                        : "text-left"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={block.columns.length}
                  className="px-3 py-4 text-center text-sm text-muted-foreground"
                >
                  No data
                </td>
              </tr>
            ) : (
              displayRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-accent/30 transition-colors border-b border-border/50 last:border-b-0"
                >
                  {block.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-sm text-foreground ${
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                            ? "text-right"
                            : "text-left"
                      }`}
                    >
                      {String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground mt-1.5 pl-3">
          and {hiddenCount} more row{hiddenCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
