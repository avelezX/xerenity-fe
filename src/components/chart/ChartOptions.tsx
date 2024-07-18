import { CrosshairMode } from 'lightweight-charts';

export const legendStyles =
  'position: absolute; left: 20px; top: 12px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 20px; font-weight: 300;';

const CHART_OPTIONS = {
  width: 0,
  height: 0,
  type: 'solid',
  color: 'transparent',
  autoSize: true,
  layout: {
    background: {
      color: 'transparent',
    },
    fontSize: 16,
  },
  watermark: {
    visible: true,
    fontSize: 100,
    color: '#a6a6a6',
    text: 'Xerenity',
  },
  grid: {
    vertLines: {
      color: '#D3D3D3',
    },
    horzLines: {
      color: '#D3D3D3',
    },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  priceScale: {
    borderColor: '#485c7b',
  },
  timeScale: {
    borderColor: '#485c7b',
    fixLeftEdge: false,
    uniformDistribution: false,
    visible: true,
  },
  rightPriceScale: {
    visible: true,
  },
  leftPriceScale: {
    visible: true,
  },
};

export default CHART_OPTIONS;
