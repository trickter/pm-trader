import { formatNumber, truncateHash } from "@/lib/utils";
import type { OpenOrderRow } from "./orders-workbench";
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

export function OpenOrdersTable({ rows }: { rows: OpenOrderRow[] }) {
  if (rows.length === 0) {
    return (
      <TableEmpty
        title="No open orders"
        description="Place an order from a market detail page, or enable a live strategy to generate orders."
      />
    );
  }

  return (
    <DataTable>
      <THead>
        <Th>Market</Th>
        <Th>Side</Th>
        <Th align="right">Price</Th>
        <Th align="right">Size</Th>
        <Th align="center">Status</Th>
        <Th align="center">Source</Th>
      </THead>
      <tbody className="divide-y divide-[var(--line)]">
        {rows.map((row) => (
          <tr key={`${row.source}-${row.id}`} className="transition hover:bg-[var(--surface-strong)]/40">
            <Td>
              <span className="font-mono text-xs" title={row.market}>
                {truncateHash(row.market, 10, 6)}
              </span>
            </Td>
            <Td>
              <SideBadge side={row.side} />
            </Td>
            <Td align="right" mono>
              {formatNumber(row.price)}
            </Td>
            <Td align="right" mono>
              {formatNumber(row.size)}
            </Td>
            <Td align="center">
              <OrderStatusBadge status={row.status} />
            </Td>
            <Td align="center">
              <div className="flex items-center justify-center gap-1.5">
                <SourceBadge source={row.source === "clob" ? "CLOB" : "Local"} />
                {row.dryRun && (
                  <span className="rounded-md bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                    DRY
                  </span>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
