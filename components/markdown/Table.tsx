"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { treeText, type TreeNode } from "@/lib/markdown-plugins";
import { downloadFile } from "@/lib/utils";
import { CopyButton, ToolButton } from "./Frame";

interface Sort {
  column: number;
  direction: "asc" | "desc";
}

interface TableState {
  sort: Sort | null;
  /** Body rows in display order, as indexes into the order they were written in. */
  order: number[] | null;
  sortable: boolean;
  toggle: (column: number) => void;
}

const TableContext = createContext<TableState | null>(null);
/** True inside the header row, so a row heading further down is left as it is. */
const HeadContext = createContext(false);

function rowsOf(node: TreeNode | undefined, section: "thead" | "tbody"): string[][] {
  const part = node?.children?.find((child) => child.tagName === section);
  return (part?.children ?? [])
    .filter((row) => row.tagName === "tr")
    .map((row) =>
      (row.children ?? [])
        .filter((cell) => cell.tagName === "td" || cell.tagName === "th")
        .map((cell) => treeText(cell).replace(/\s+/g, " ").trim()),
    );
}

/** A table drawn with merged cells has no single value per column to sort on. */
function hasSpans(node: TreeNode | undefined): boolean {
  if (!node) return false;
  if (node.properties && ("rowSpan" in node.properties || "colSpan" in node.properties)) return true;
  return (node.children ?? []).some(hasSpans);
}

/** The number a cell leads with - "1,200 ms", "45%", "$3.50" - or null. */
function leadingNumber(text: string): number | null {
  const match = text.replace(/^[\s$€£₹¥~≈<>≤≥+]*/, "").match(/^-?\d[\d,]*(?:\.\d+)?|^-?\.\d+/);
  if (!match) return null;
  const value = Number.parseFloat(match[0].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function sortedOrder(rows: string[][], sort: Sort): number[] {
  const cells = rows.map((row) => row[sort.column] ?? "");
  const numbers = cells.map(leadingNumber);
  // Numeric only when every filled cell is one; "N/A" in a column of prices is still sorted last.
  const filled = cells.filter((cell) => cell && !/^(?:n\/?a|-|–|—)$/i.test(cell));
  const numeric = filled.length > 0 && filled.every((cell) => leadingNumber(cell) !== null);
  const sign = sort.direction === "asc" ? 1 : -1;

  return rows
    .map((_, index) => index)
    .sort((a, b) => {
      if (numeric) {
        const [x, y] = [numbers[a], numbers[b]];
        if (x === null || y === null) return x === y ? a - b : x === null ? 1 : -1;
        return (x - y) * sign || a - b;
      }
      if (!cells[a] || !cells[b]) return cells[a] === cells[b] ? a - b : cells[a] ? -1 : 1;
      return cells[a].localeCompare(cells[b], undefined, { numeric: true, sensitivity: "base" }) * sign || a - b;
    });
}

const quote = (cell: string, separator: string) =>
  cell.includes(separator) || /["\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

/**
 * A table that can be put in order and taken away.
 *
 * Tapping a heading sorts by that column - numbers as numbers, text as text -
 * and a third tap puts the rows back the way the answer had them. Copy puts
 * tab-separated rows on the clipboard, which is what a spreadsheet or a
 * document pastes back out as a table.
 */
export function Table({ node, children }: { node?: TreeNode; children?: ReactNode }) {
  const [sort, setSort] = useState<Sort | null>(null);

  const { head, body, sortable } = useMemo(() => {
    const head = rowsOf(node, "thead");
    const body = rowsOf(node, "tbody");
    return { head, body, sortable: body.length > 1 && head.length === 1 && !hasSpans(node) };
  }, [node]);

  const state = useMemo<TableState>(
    () => ({
      sort,
      sortable,
      order: sort ? sortedOrder(body, sort) : null,
      toggle: (column) =>
        setSort((current) =>
          current?.column !== column
            ? { column, direction: "asc" }
            : current.direction === "asc"
              ? { column, direction: "desc" }
              : null,
        ),
    }),
    [body, sort, sortable],
  );

  const serialise = (separator: string) => {
    const rows = state.order ? state.order.map((index) => body[index]) : body;
    return [...head, ...rows].map((row) => row.map((cell) => quote(cell, separator)).join(separator)).join("\n");
  };

  const columns = Math.max(0, ...head.map((row) => row.length), ...body.map((row) => row.length));

  return (
    <TableContext.Provider value={state}>
      <div className="overflow-hidden rounded-card shadow-hairline">
        <div className="table-scroll">
          <table>{children}</table>
        </div>
        <div className="flex h-7 items-center justify-between gap-2 bg-inset pl-3 pr-1.5 shadow-[inset_0_1px_0_var(--line)]">
          <span className="truncate font-mono text-[10.5px] text-ink-3">
            {body.length} {body.length === 1 ? "row" : "rows"} · {columns}{" "}
            {columns === 1 ? "column" : "columns"}
            {sort ? ` · sorted by ${head[0]?.[sort.column] || `column ${sort.column + 1}`}` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <ToolButton
              title="Save as CSV"
              onClick={() => downloadFile("table.csv", `${serialise(",")}\n`, "text/csv")}
            >
              <Download size={12} strokeWidth={2.2} />
            </ToolButton>
            <CopyButton text={() => serialise("\t")} title="Copy table" />
          </div>
        </div>
      </div>
    </TableContext.Provider>
  );
}

/** Lays the body rows out in the sorted order, leaving the rows themselves alone. */
export function TableBody({ children }: { children?: ReactNode }) {
  const state = useContext(TableContext);
  const rows = Children.toArray(children).filter(isValidElement);
  const order = state?.order?.length === rows.length ? state.order : null;
  return <tbody>{order ? order.map((index) => rows[index]) : rows}</tbody>;
}

export function TableHead({ children }: { children?: ReactNode }) {
  return (
    <HeadContext.Provider value>
      <thead>{children}</thead>
    </HeadContext.Provider>
  );
}

export function TableHeading({
  node,
  children,
}: {
  node?: TreeNode;
  children?: ReactNode;
}) {
  const state = useContext(TableContext);
  const inHead = useContext(HeadContext);
  // A cell only learns which column it is once it is in the table.
  const [column, setColumn] = useState(-1);
  const align = node?.properties?.align as "left" | "center" | "right" | undefined;

  const active = state?.sort?.column === column ? state.sort : null;
  const Icon = active ? (active.direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  if (!state?.sortable || !inHead) {
    return <th style={align ? { textAlign: align } : undefined}>{children}</th>;
  }

  return (
    <th
      ref={(element) => {
        if (element && element.cellIndex !== column) setColumn(element.cellIndex);
      }}
      aria-sort={active ? (active.direction === "asc" ? "ascending" : "descending") : "none"}
      style={align ? { textAlign: align } : undefined}
    >
      <button
        type="button"
        onClick={() => state.toggle(column)}
        className="group/sort -mx-1 inline-flex items-center gap-1 rounded-chip px-1 text-inherit uppercase tracking-[inherit] hover:text-ink"
      >
        {children}
        <Icon
          size={11}
          strokeWidth={2.4}
          className={active ? "text-accent-ink" : "opacity-35 group-hover/sort:opacity-80"}
        />
      </button>
    </th>
  );
}
