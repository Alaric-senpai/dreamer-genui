import type { ReactNode } from 'react';
import type { CompareBlock } from '../../schema/blocks';
import { useOverride, useParts } from '../anatomy';
import { renderInline } from './inline';

/**
 * Side-by-side comparison grid (§6.5). `highlight` marks one column and/or
 * row without the tutor supplying any CSS; every part is themeable and
 * replaceable through the standard anatomy contract (§8.5).
 */
export function CompareView({ block }: { block: CompareBlock }): ReactNode {
  const p = useParts('compare');
  const override = useOverride('compare');
  const rows = Math.max(0, ...block.columns.map((col) => col.items.length));
  const defaultView = (
    <div
      {...p.props('root', 'dg-compare')}
      data-node-id={block.id}
      role="table"
      aria-label="Comparison"
    >
      {block.columns.map((col, ci) => (
        <div
          {...p.props('column', 'dg-compare-column')}
          key={col.id}
          role="columnheader"
          data-dg-col={col.id}
          data-dg-highlight={block.highlight?.col === col.id ? 'true' : undefined}
        >
          <div {...p.props('column-title', 'dg-compare-column-title')}>{renderInline(col.title)}</div>
          {Array.from({ length: rows }, (_, ri) => {
            const content = col.items[ri];
            return (
              <div
                {...p.props('item', 'dg-compare-item')}
                key={ri}
                role="cell"
                data-dg-row={ri}
                data-dg-highlight={block.highlight?.row === ri && block.highlight?.col === col.id ? 'true' : undefined}
              >
                {content ? renderInline(content) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
  return override ? override({ block, renderDefault: () => defaultView }) : defaultView;
}
