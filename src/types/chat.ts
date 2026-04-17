export interface SeriesAction {
  tickers: string[];
  names: string[];
  description: string;
}

export interface ChartControlAction {
  action: 'set_period' | 'normalize' | 'clear' | 'remove_series';
  period?: string;
  normalize?: boolean;
  ticker?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallResult[];
  charts?: ChartSpec[];
  navigationTarget?: string;
  seriesAction?: SeriesAction;
  chartControlAction?: ChartControlAction;
}

export interface ToolCallResult {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
}

export interface ChartSpec {
  chart_type: 'line' | 'bar' | 'area';
  title: string;
  x_axis_key: string;
  series: ChartSeries[];
  data: Record<string, unknown>[];
}

export interface ChartSeries {
  data_key: string;
  name: string;
  color?: string;
}

export interface SSEEvent {
  type: 'text_delta' | 'tool_use' | 'tool_result' | 'done' | 'error';
  text?: string;
  tool?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  chartData?: ChartSpec;
  navigationTarget?: string;
  seriesData?: { tickers: string[]; names: string[]; description: string };
  chartAction?: ChartControlAction;
  error?: string;
}

export interface ChatApiRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
