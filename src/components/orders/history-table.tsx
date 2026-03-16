import { formatNumber, truncateHash } from "@/lib/utils";
import type { HistoryRow } from "./orders-workbench";
import {
  DataTable,
  THead,
  Th,
  Td,
  SideBadge,
  SourceBadge,
  OrderStatusBadge,
  TableEmpty,
} from "./table-primitives";

const SOURCE_LABELS: Record<string, string> = {
  "clob-trade": "CLOB",
  "local-order": "Local",
  "local-fill": "Fill",
};

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <TableEmpty
        title="No history"
        description="Completed orders and fills will appear here once trades are executed."
      />
    );
  }

  return (
    <DataTable>
      <THead>
        <Th>Market</Th>
        <Th>Type</Th>
        <Th>Side</Th>
        <Th align="right">Price</Th>
        <Th align="right">Size</Th>
        <Th align="center">Status</Th>
        <Th align="right">Time</Th>
      </THead>
      <tbody className="divide-y divide-[var(--line)]">
        {rows.map((row, index) => (
          <tr key={`${row.source}-${row.id}-${index}`} className="transition hover:bg-[var(--surface-strong)]/40">
            <Td>
              <span className="font-mono text-xs" title={row.market}>
                {truncateHash(row.market, 10, 6)}
              </span>
            </Td>
            <Td>
              <SourceBadge source={SOURCE_LABELS[row.source] ?? row.source} />
            </Td>
            <Td>
              <SideBadge side={row.traderSide ?? row.side} />
            </Td>
            <Td align="right" mono>
              {formatNumber(row.price)}
            </Td>
            <Td align="right" mono>
              {formatNumber(row.size)}
            </Td>
            <Td align="center">
              {row.status ? (
                <OrderStatusBadge status={row.status} />
              ) : row.fillSource ? (
                <SourceBadge source={row.fillSource} />
              ) : (
                <span className="text-xs text-[var(--muted)]">--</span>
              )}
            </Td>
            <Td align="right" muted className="text-xs">
              {row.createdAt ?? "--"}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
