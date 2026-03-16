import { formatNumber, truncateHash } from "@/lib/utils";
import type { PositionRow } from "./orders-workbench";
import { DataTable, THead, Th, Td, SourceBadge, TableEmpty } from "./table-primitives";

export function PositionsTable({ rows }: { rows: PositionRow[] }) {
  if (rows.length === 0) {
    return (
      <TableEmpty
        title="No positions"
        description="Configure POLYMARKET_TRADER_ADDRESS and ensure the address has open positions on Data API."
      />
    );
  }

  return (
    <DataTable>
      <THead>
        <Th>Market</Th>
        <Th>Asset</Th>
        <Th align="right">Size</Th>
        <Th align="right">Value</Th>
        <Th align="center">Source</Th>
      </THead>
      <tbody className="divide-y divide-[var(--line)]">
        {rows.map((row) => (
          <tr key={row.id} className="transition hover:bg-[var(--surface-strong)]/40">
            <Td>
              <div className="max-w-[280px]">
                <p className="truncate font-medium" title={row.title}>
                  {row.title}
                </p>
                {row.outcome && (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{row.outcome}</p>
                )}
              </div>
            </Td>
            <Td mono muted>
              <span title={row.asset}>{truncateHash(row.asset, 8, 6)}</span>
            </Td>
            <Td align="right" mono>
              {formatNumber(row.size)}
            </Td>
            <Td align="right" mono>
              {formatNumber(row.currentValue)}
            </Td>
            <Td align="center">
              <SourceBadge source="Data API" />
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
