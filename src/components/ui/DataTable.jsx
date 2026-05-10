// Columns API: { key, label, render?, sort?, align?, mono?, hide? }
//
// Virtualization is enabled automatically when data.length > 50.
// mobileCardRender: below 768px rows render as stacked cards.

import { useState, useMemo, useRef, useId } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Download, Rows3, Rows4, Rows, ChevronUp, ChevronDown } from 'lucide-react';
import useMediaQuery from '../../hooks/useMediaQuery';
import EmptyState from './EmptyState';
import GlassCard from './GlassCard';
import { Inbox } from 'lucide-react';

const DENSITIES = {
  compact: 32,
  default: 40,
  relaxed: 48,
};

const DENSITY_ICONS = {
  compact: Rows4,
  default: Rows3,
  relaxed: Rows,
};

export default function DataTable({
  columns,
  data,
  defaultSort,
  onRowClick,
  emptyMessage = 'Aucune donnée à afficher',
  emptyTitle = 'Vide',
  emptyIcon,
  virtualize, // force virtualization on/off; auto when undefined
  maxHeight = 560,
  density: densityProp,
  enableSearch = true,
  enableExport, // (rows: T[]) => void
  mobileCardRender, // (row: T) => ReactNode
  containerClassName,
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const id = useId();
  const [sorting, setSorting] = useState(
    defaultSort ? [{ id: defaultSort.key, desc: defaultSort.dir === 'desc' }] : []
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [density, setDensity] = useState(densityProp || 'default');
  const rowHeight = DENSITIES[density] || DENSITIES.default;

  const visibleColumns = useMemo(() => columns.filter((c) => !c.hide), [columns]);

  const tableColumns = useMemo(
    () =>
      visibleColumns.map((col) => ({
        id: col.key,
        header: col.label,
        accessorFn: (row) => row[col.key],
        enableSorting: !!col.sort,
        cell: (info) => {
          const val = info.getValue();
          const rowData = info.row.original;
          if (col.render) return col.render(val, rowData);
          return val;
        },
        meta: { align: col.align || 'left', mono: !!col.mono },
      })),
    [visibleColumns]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns fns safe to pass through; rule is overly strict
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const useVirtual = virtualize ?? rows.length > 50;

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: useVirtual,
  });

  // ── Toolbar ─────────────────────────────────────────────────
  const toolbar = (enableSearch || enableExport) && (
    <div className="v3-table-toolbar" role="toolbar" aria-label="Filtres et densité">
      {enableSearch && (
        <label className="v3-table-toolbar__search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Rechercher…"
            aria-label="Rechercher dans la table"
          />
        </label>
      )}
      <div className="v3-table-toolbar__right">
        <div className="v3-table-toolbar__density" role="group" aria-label="Densité">
          {Object.keys(DENSITIES).map((k) => {
            const Icon = DENSITY_ICONS[k];
            return (
              <button
                key={k}
                type="button"
                className="v3-table-toolbar__density-btn"
                data-active={density === k || undefined}
                onClick={() => setDensity(k)}
                aria-pressed={density === k}
                aria-label={`Densité ${k}`}
              >
                <Icon size={13} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        {enableExport && (
          <button
            type="button"
            className="v3-table-toolbar__export-btn"
            onClick={() => enableExport(data)}
            aria-label="Exporter les données"
          >
            <Download size={13} aria-hidden="true" />
            Export CSV
          </button>
        )}
      </div>
    </div>
  );

  // ── Empty state ────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div className={['v3-table-wrap', containerClassName].filter(Boolean).join(' ')}>
        {toolbar}
        <EmptyState
          size="compact"
          icon={emptyIcon || Inbox}
          title={emptyTitle}
          description={emptyMessage}
        />
      </div>
    );
  }

  // ── Mobile cards mode ──────────────────────────────────────
  if (isMobile && mobileCardRender) {
    const filteredRows = rows.map((r) => r.original);
    return (
      <div className={['v3-table-wrap', containerClassName].filter(Boolean).join(' ')}>
        {toolbar}
        <div className="v3-table-cards">
          {filteredRows.length === 0 ? (
            <EmptyState
              size="compact"
              icon={emptyIcon || Inbox}
              title={emptyTitle}
              description={emptyMessage}
            />
          ) : (
            filteredRows.map((row, i) => (
              <GlassCard
                key={row.id || `${id}-${i}`}
                variant="subtle"
                hover={!!onRowClick}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className="v3-table-card"
              >
                {mobileCardRender(row)}
              </GlassCard>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Table header ───────────────────────────────────────────
  const headerContent = (
    <thead>
      {table.getHeaderGroups().map((hg) => (
        <tr key={hg.id}>
          {hg.headers.map((header) => {
            const meta = header.column.columnDef.meta;
            const canSort = header.column.getCanSort();
            const isSorted = header.column.getIsSorted();
            const ariaSort = !canSort
              ? undefined
              : isSorted === 'asc'
                ? 'ascending'
                : isSorted === 'desc'
                  ? 'descending'
                  : 'none';
            return (
              <th
                key={header.id}
                scope="col"
                aria-sort={ariaSort}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                className={`v3-table__th v3-table__th--${meta?.align || 'left'}`}
                data-sorted={isSorted || undefined}
                data-can-sort={canSort || undefined}
              >
                <span className="v3-table__th-inner">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {canSort && isSorted && (
                    <span aria-hidden="true" className="v3-table__th-sort">
                      {isSorted === 'asc' ? (
                        <ChevronUp size={11} strokeWidth={2.5} />
                      ) : (
                        <ChevronDown size={11} strokeWidth={2.5} />
                      )}
                    </span>
                  )}
                </span>
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );

  const renderRow = (row) => {
    const rowData = row.original;
    const pnl = rowData.pnlUsd ?? rowData.pnl ?? 0;
    const tone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
    return (
      <tr
        key={row.id}
        onClick={onRowClick ? () => onRowClick(rowData) : undefined}
        onKeyDown={
          onRowClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(rowData);
                }
              }
            : undefined
        }
        tabIndex={onRowClick ? 0 : undefined}
        data-tone={tone}
        data-clickable={onRowClick ? 'true' : undefined}
        className="v3-table__row"
        style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
      >
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta;
          return (
            <td
              key={cell.id}
              className={`v3-table__td v3-table__td--${meta?.align || 'left'}${meta?.mono ? ' mono' : ''}`}
              style={{ height: rowHeight }}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    );
  };

  // ── Virtualized or plain body ──────────────────────────────
  if (useVirtual) {
    const virtualRows = virtualizer.getVirtualItems();
    return (
      <div className={['v3-table-wrap', containerClassName].filter(Boolean).join(' ')}>
        {toolbar}
        <div
          ref={parentRef}
          className="v3-table-scroller"
          style={{ maxHeight, overflowY: 'auto' }}
          aria-label="Zone de défilement table"
        >
          <table className="v3-table" aria-rowcount={rows.length}>
            {headerContent}
            <tbody>
              {virtualRows.length > 0 && virtualRows[0].start > 0 && (
                <tr style={{ height: virtualRows[0].start }}>
                  <td colSpan={visibleColumns.length} />
                </tr>
              )}
              {virtualRows.map((vr) => renderRow(rows[vr.index]))}
              {virtualRows.length > 0 && (
                <tr
                  style={{
                    height: Math.max(
                      0,
                      virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)
                    ),
                  }}
                >
                  <td colSpan={visibleColumns.length} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={['v3-table-wrap', containerClassName].filter(Boolean).join(' ')}>
      {toolbar}
      <div className="v3-table-scroller" style={{ maxHeight, overflowY: 'auto' }}>
        <table className="v3-table">
          {headerContent}
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    </div>
  );
}
