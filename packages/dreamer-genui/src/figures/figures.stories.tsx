import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Reply } from '../schema/envelope';
import { createBoardStore } from '../react/use-board';
import { createRegistry } from '../core/registry';
import { DreamerProvider } from '../react/provider';
import { Board } from '../react/board';
import flowchartReply from '../../../../fixtures/process-flowchart.json';
import radialReply from '../../../../fixtures/diagram-radial.json';
import cycleReply from '../../../../fixtures/diagram-cycle.json';
import timelineReply from '../../../../fixtures/timeline.json';
import labeledReply from '../../../../fixtures/labeled-art.json';
import lottieReply from '../../../../fixtures/lottie-basic.json';
import chartBarReply from '../../../../fixtures/chart-bar.json';
import chartLineReply from '../../../../fixtures/chart-line.json';
import chartAreaReply from '../../../../fixtures/chart-area.json';
import chartPieReply from '../../../../fixtures/chart-pie.json';
import chartRadarReply from '../../../../fixtures/chart-radar.json';
import chartRadialbarReply from '../../../../fixtures/chart-radialbar.json';
import chartScatterReply from '../../../../fixtures/chart-scatter.json';
import chartComposedReply from '../../../../fixtures/chart-composed.json';
import chartFunnelReply from '../../../../fixtures/chart-funnel.json';
import chartTreemapReply from '../../../../fixtures/chart-treemap.json';
import chartSankeyReply from '../../../../fixtures/chart-sankey.json';

/** A tiny embedded Lottie animation so the story needs no network or public asset. */
const LOTTIE_ANIMATION = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 160,
  h: 120,
  nm: 'Pulse dot',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Dot',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: {
          a: 1,
          k: [
            { t: 0, s: [80, 68, 0], e: [80, 52, 0] },
            { t: 30, s: [80, 52, 0], e: [80, 68, 0] },
            { t: 60, s: [80, 68, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [30, 30] }, nm: 'Ellipse' },
            { ty: 'fl', c: { a: 0, k: [0.18, 0.36, 0.77, 1] }, o: { a: 0, k: 100 }, r: 1, nm: 'Fill' },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
              sk: { a: 0, k: 0 },
              sa: { a: 0, k: 0 },
              nm: 'Transform',
            },
          ],
          nm: 'Dot group',
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
};

const lottieDataUri = `data:application/json,${encodeURIComponent(JSON.stringify(LOTTIE_ANIMATION))}`;

function renderReply(reply: unknown, assets?: Record<string, string>) {
  const registry = createRegistry();
  const store = createBoardStore({ registry });
  store.applyFinal(reply as Reply);
  return (
    <DreamerProvider registry={registry} resolveAsset={(id) => assets?.[id]}>
      <Board store={store} pacing="auto" camera="off" ambience="off" />
    </DreamerProvider>
  );
}

const meta: Meta = {
  title: 'Figures/Board',
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

export const Flowchart: StoryObj = {
  render: () => renderReply(flowchartReply),
};

export const RadialDiagram: StoryObj = {
  render: () => renderReply(radialReply),
};

export const CycleDiagram: StoryObj = {
  render: () => renderReply(cycleReply),
};

export const Timeline: StoryObj = {
  render: () => renderReply(timelineReply),
};

export const LabeledArt: StoryObj = {
  render: () => renderReply(labeledReply),
};

export const Lottie: StoryObj = {
  render: () => renderReply(lottieReply, { 'wave-animation-v1': lottieDataUri }),
};

export const ChartBar: StoryObj = {
  render: () => renderReply(chartBarReply),
};

export const ChartLine: StoryObj = {
  render: () => renderReply(chartLineReply),
};

export const ChartArea: StoryObj = {
  render: () => renderReply(chartAreaReply),
};

export const ChartPie: StoryObj = {
  render: () => renderReply(chartPieReply),
};

export const ChartRadar: StoryObj = {
  render: () => renderReply(chartRadarReply),
};

export const ChartRadialBar: StoryObj = {
  render: () => renderReply(chartRadialbarReply),
};

export const ChartScatter: StoryObj = {
  render: () => renderReply(chartScatterReply),
};

export const ChartComposed: StoryObj = {
  render: () => renderReply(chartComposedReply),
};

export const ChartFunnel: StoryObj = {
  render: () => renderReply(chartFunnelReply),
};

export const ChartTreemap: StoryObj = {
  render: () => renderReply(chartTreemapReply),
};

export const ChartSankey: StoryObj = {
  render: () => renderReply(chartSankeyReply),
};
