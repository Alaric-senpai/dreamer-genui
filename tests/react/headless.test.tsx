// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DreamerProvider } from '../../packages/dreamer-genui/src/react/provider';
import { BoardStoreProvider } from '../../packages/dreamer-genui/src/react/store-context';
import {
  useAssessment,
  useBoardStatus,
  useBoardStore,
  useCue,
  useLayout,
  useNode,
  useNodeEnter,
  useRegistry,
  useTheme,
} from '../../packages/dreamer-genui/src/react/headless';
import { createBoardStore } from '../../packages/dreamer-genui/src/react/use-board';
import { createRegistry } from '../../packages/dreamer-genui/src/core/registry';
import type { Reply } from '../../packages/dreamer-genui/src/schema/envelope';

afterEach(cleanup);

const reply: Reply = {
  v: 1,
  ops: [
    {
      op: 'append',
      blocks: [
        { id: 'intro', type: 'text', variant: 'body', content: ['Hello'] },
        {
          id: 'late',
          type: 'text',
          variant: 'body',
          content: ['Later'],
          enter: { effect: 'reveal', trigger: { on: 'cue', id: 'beat' } },
        },
      ],
    },
    { op: 'layout', layout: { kind: 'split' } },
  ],
};

function Probe({ expectedRegistry }: { expectedRegistry: ReturnType<typeof createRegistry> }): React.ReactNode {
  const store = useBoardStore();
  const node = useNode('intro');
  const late = useNodeEnter('late');
  const cues = useCue();
  const layout = useLayout();
  const theme = useTheme();
  const status = useBoardStatus();
  const registry = useRegistry();
  const assessment = useAssessment('missing');

  return (
    <div>
      <span data-testid="node">{node?.block.type ?? 'none'}</span>
      <span data-testid="late">{late.entered ? 'entered' : late.pending ? 'pending' : 'idle'}</span>
      <span data-testid="fired">{cues.fired.join(',') || 'none'}</span>
      <span data-testid="pending">{cues.pending.join(',') || 'none'}</span>
      <span data-testid="layout">{layout.kind}</span>
      <span data-testid="theme">{theme ? 'set' : 'default'}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="registry">{registry === expectedRegistry ? 'same' : 'different'}</span>
      <span data-testid="assessment">{assessment.machine ? 'machine' : 'none'}</span>
      <button type="button" onClick={() => cues.fire('beat')}>fire</button>
      <button type="button" onClick={() => store.applyFinal(reply)}>apply</button>
    </div>
  );
}

describe('headless hooks', () => {
  test('expose node, entry, cue, layout, status and registry', () => {
    const registry = createRegistry();
    const store = createBoardStore({ registry });
    act(() => store.applyFinal(reply));

    render(
      <DreamerProvider registry={registry}>
        <BoardStoreProvider store={store} status="thinking">
          <Probe expectedRegistry={registry} />
        </BoardStoreProvider>
      </DreamerProvider>,
    );

    expect(screen.getByTestId('node')).toHaveTextContent('text');
    expect(screen.getByTestId('late')).toHaveTextContent('pending');
    expect(screen.getByTestId('fired')).toHaveTextContent('none');
    expect(screen.getByTestId('pending')).toHaveTextContent('beat');
    expect(screen.getByTestId('layout')).toHaveTextContent('split');
    expect(screen.getByTestId('theme')).toHaveTextContent('default');
    expect(screen.getByTestId('status')).toHaveTextContent('thinking');
    expect(screen.getByTestId('assessment')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByTestId('late')).toHaveTextContent('entered');
    expect(screen.getByTestId('fired')).toHaveTextContent('beat');
    expect(screen.getByTestId('pending')).toHaveTextContent('none');
  });

  test('useBoardStore outside a provider throws a helpful error', () => {
    function Naked(): React.ReactNode {
      useBoardStore();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(/useBoardStore must be used inside/);
  });
});
