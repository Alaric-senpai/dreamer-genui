/**
 * Table block (M6a). Plain semantic HTML, token-styled, with row and column
 * highlighting. Kept in the initial bundle: it pulls in no heavy dependency.
 */
import type { ReactNode } from 'react';
import type { TableBlock } from '../../schema/blocks';
import { useEmitEvent } from '../provider';
import { useOverride, useParts } from '../anatomy';
import { renderInline } from './inline';

export function TableView({ block }: { block: TableBlock }): ReactNode {
  const p = useParts('table');
  const override = useOverride('table');
  const emit = useEmitEvent();

  const highlightedRows = new Set(block.highlight?.rows ?? []);
  const highlightedCols = new Set(block.highlight?.cols ?? []);

  const defaultView = (
    <div {...p.props('root', 'dg-table-wrap')} data-node-id={block.id}>
      <table {...p.props('table', 'dg-table')}>
        <thead>
          <tr>
            {block.columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className="dg-table-head"
                data-dg-part="head"
                data-dg-col={col.id}
                data-dg-highlight={highlightedCols.has(col.id) ? 'true' : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr
              key={ri}
              className="dg-table-row"
              data-dg-part="row"
              data-dg-row={ri}
              data-dg-highlight={highlightedRows.has(ri) ? 'true' : undefined}
            >
              {block.columns.map((col, ci) => (
                <td
                  key={col.id}
                  className="dg-table-cell"
                  data-dg-part="cell"
                  data-dg-col={col.id}
                  data-dg-row={ri}
                  data-dg-highlight={highlightedCols.has(col.id) ? 'true' : undefined}
                  tabIndex={0}
                  onFocus={() =>
                    emit({ type: 'focus', nodeId: block.id, ref: `r${ri}c${ci}` })
                  }
                >
                  {renderInline(row[col.id] ?? [])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}
