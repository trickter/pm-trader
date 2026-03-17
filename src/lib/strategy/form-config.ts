export const strategyTypeOptions = [
  "TWO_SIDED_RANGE_QUOTING",
  "THRESHOLD_BREAKOUT",
  "ORDERBOOK_IMBALANCE",
] as const;

export type StrategyTypeOption = (typeof strategyTypeOptions)[number];

type BaseField = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

type TextLikeField = BaseField & {
  kind: "text" | "number" | "hidden";
  defaultValue?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
};

type SelectField = BaseField & {
  kind: "select";
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
};

type CheckboxField = BaseField & {
  kind: "checkbox";
  defaultChecked?: boolean;
};

export type StrategyFormField = TextLikeField | SelectField | CheckboxField;

export type StrategyFormSection = {
  key: string;
  title?: string;
  description?: string;
  fields: StrategyFormField[];
};

type StrategyFormDefinition = {
  label: string;
  description: string;
  sections: StrategyFormSection[];
};

export const commonStrategySections: StrategyFormSection[] = [
  {
    key: "identity",
    fields: [
      {
        kind: "text",
        name: "name",
        label: "strategy name",
        placeholder: "Range quoting on mid-prob market",
        required: true,
      },
      {
        kind: "text",
        name: "marketId",
        label: "marketId",
        required: true,
      },
    ],
  },
  {
    key: "routing",
    title: "策略路由",
    description: "只展示当前策略类型真正会使用或必须落库的参数。",
    fields: [],
  },
  {
    key: "execution",
    title: "通用参数",
    fields: [
      {
        kind: "number",
        name: "maxOrderSize",
        label: "max order size",
        step: "0.01",
        defaultValue: "5",
        required: true,
      },
      {
        kind: "number",
        name: "maxDailyTradeCount",
        label: "max daily trade count",
        step: "1",
        defaultValue: "10",
        required: true,
      },
      {
        kind: "number",
        name: "cooldownSeconds",
        label: "cooldown seconds",
        step: "1",
        defaultValue: "30",
        required: true,
      },
      {
        kind: "checkbox",
        name: "pauseOnStaleData",
        label: "pause on stale data",
        defaultChecked: true,
      },
      {
        kind: "checkbox",
        name: "cancelOpenOrdersOnStaleData",
        label: "cancel open orders on stale data",
      },
      {
        kind: "checkbox",
        name: "dryRun",
        label: "dry-run",
        defaultChecked: true,
      },
      {
        kind: "checkbox",
        name: "enabled",
        label: "enabled",
        defaultChecked: true,
      },
    ],
  },
];

export const strategyFormDefinitions: Record<StrategyTypeOption, StrategyFormDefinition> = {
  THRESHOLD_BREAKOUT: {
    label: "THRESHOLD_BREAKOUT",
    description: "价格阈值突破后触发单边信号。",
    sections: [
      {
        key: "routing-threshold",
        fields: [
          {
            kind: "text",
            name: "tokenId",
            label: "tokenId",
            required: true,
          },
          {
            kind: "select",
            name: "side",
            label: "side",
            defaultValue: "BUY",
            options: [
              { value: "BUY", label: "BUY" },
              { value: "SELL", label: "SELL" },
            ],
          },
        ],
      },
      {
        key: "trigger-threshold",
        title: "阈值参数",
        fields: [
          {
            kind: "select",
            name: "comparator",
            label: "threshold comparator",
            defaultValue: "gte",
            options: [
              { value: "gte", label: "gte" },
              { value: "lte", label: "lte" },
            ],
          },
          {
            kind: "number",
            name: "threshold",
            label: "threshold",
            step: "0.001",
            min: "0",
            max: "1",
            defaultValue: "0.55",
          },
        ],
      },
    ],
  },
  ORDERBOOK_IMBALANCE: {
    label: "ORDERBOOK_IMBALANCE",
    description: "按买一卖一深度失衡与点差约束触发单边信号。",
    sections: [
      {
        key: "routing-imbalance",
        fields: [
          {
            kind: "text",
            name: "tokenId",
            label: "tokenId",
            required: true,
          },
          {
            kind: "select",
            name: "side",
            label: "side",
            defaultValue: "BUY",
            options: [
              { value: "BUY", label: "BUY" },
              { value: "SELL", label: "SELL" },
            ],
          },
        ],
      },
      {
        key: "trigger-imbalance",
        title: "盘口失衡参数",
        fields: [
          {
            kind: "number",
            name: "maxSpread",
            label: "max spread (imbalance)",
            step: "0.001",
            min: "0",
            max: "1",
            defaultValue: "0.02",
          },
          {
            kind: "number",
            name: "minTopDepth",
            label: "min top depth",
            step: "1",
            min: "0",
            defaultValue: "50",
          },
          {
            kind: "number",
            name: "imbalanceRatio",
            label: "imbalance ratio",
            step: "0.01",
            min: "0",
            defaultValue: "0.65",
          },
        ],
      },
    ],
  },
  TWO_SIDED_RANGE_QUOTING: {
    label: "TWO_SIDED_RANGE_QUOTING",
    description: "双边区间挂单策略，自动按 YES/NO 两侧扫描和管理库存。",
    sections: [
      {
        key: "routing-range",
        fields: [
          {
            kind: "text",
            name: "tokenId",
            label: 'tokenId (use "auto" for two-sided)',
            defaultValue: "auto",
            required: true,
          },
          {
            kind: "hidden",
            name: "side",
            label: "side",
            defaultValue: "BUY",
          },
        ],
      },
      {
        key: "range-pricing",
        title: "区间价格参数",
        fields: [
          {
            kind: "number",
            name: "entryLow",
            label: "entry low",
            step: "0.01",
            min: "0.01",
            max: "0.99",
            defaultValue: "0.36",
          },
          {
            kind: "number",
            name: "entryHigh",
            label: "entry high",
            step: "0.01",
            min: "0.01",
            max: "0.99",
            defaultValue: "0.42",
          },
          {
            kind: "number",
            name: "exitLow",
            label: "exit low",
            step: "0.01",
            min: "0.01",
            max: "0.99",
            defaultValue: "0.58",
          },
          {
            kind: "number",
            name: "exitHigh",
            label: "exit high",
            step: "0.01",
            min: "0.01",
            max: "0.99",
            defaultValue: "0.64",
          },
        ],
      },
      {
        key: "range-inventory",
        title: "库存与下单约束",
        fields: [
          {
            kind: "number",
            name: "orderSize",
            label: "order size",
            step: "0.01",
            min: "0.01",
            defaultValue: "5",
          },
          {
            kind: "number",
            name: "maxInventoryPerSide",
            label: "max inventory per side",
            step: "1",
            min: "1",
            defaultValue: "25",
          },
          {
            kind: "number",
            name: "maxInventoryPerMarket",
            label: "max inventory per market",
            step: "1",
            min: "1",
            defaultValue: "40",
          },
          {
            kind: "number",
            name: "maxOpenOrdersPerSide",
            label: "max open orders per side",
            step: "1",
            min: "1",
            defaultValue: "2",
          },
        ],
      },
      {
        key: "range-market-selection",
        title: "市场筛选参数",
        fields: [
          {
            kind: "number",
            name: "maxMarketsTracked",
            label: "max markets tracked",
            step: "1",
            min: "1",
            defaultValue: "10",
          },
          {
            kind: "number",
            name: "minLiquidity",
            label: "min liquidity (USD)",
            step: "100",
            min: "0",
            defaultValue: "10000",
          },
          {
            kind: "number",
            name: "minVolume24h",
            label: "min volume 24h (USD)",
            step: "100",
            min: "0",
            defaultValue: "1000",
          },
          {
            kind: "number",
            name: "minBookDepth",
            label: "min book depth (USD)",
            step: "10",
            min: "0",
            defaultValue: "200",
          },
          {
            kind: "number",
            name: "rangeMaxSpread",
            label: "max spread (range)",
            step: "0.01",
            min: "0",
            max: "1",
            defaultValue: "0.08",
          },
          {
            kind: "number",
            name: "minTimeToExpiryMinutes",
            label: "min time to expiry (minutes)",
            step: "60",
            min: "0",
            defaultValue: "4320",
          },
        ],
      },
      {
        key: "range-runtime",
        title: "扫描与刷新参数",
        fields: [
          {
            kind: "number",
            name: "quoteRefreshSeconds",
            label: "quote refresh (seconds)",
            step: "5",
            min: "1",
            defaultValue: "60",
          },
          {
            kind: "number",
            name: "staleQuoteSeconds",
            label: "stale quote (seconds)",
            step: "10",
            min: "1",
            defaultValue: "300",
          },
          {
            kind: "number",
            name: "scanIntervalSeconds",
            label: "scan interval (seconds)",
            step: "10",
            min: "1",
            defaultValue: "300",
          },
        ],
      },
      {
        key: "range-filters",
        title: "过滤器",
        fields: [
          {
            kind: "checkbox",
            name: "trendFilterEnabled",
            label: "trend filter",
            defaultChecked: true,
          },
          {
            kind: "number",
            name: "trendFilterThreshold",
            label: "trend filter threshold",
            step: "0.01",
            min: "0",
            max: "1",
            defaultValue: "0.10",
          },
          {
            kind: "checkbox",
            name: "allowBothSidesInventory",
            label: "allow both sides inventory",
            defaultChecked: true,
          },
        ],
      },
    ],
  },
};

export function getStrategyFormDefaults(type: StrategyTypeOption) {
  const sections = [...commonStrategySections, ...strategyFormDefinitions[type].sections];
  const defaults: Record<string, string | boolean> = { type };

  for (const section of sections) {
    for (const field of section.fields) {
      if (field.kind === "checkbox") {
        defaults[field.name] = field.defaultChecked ?? false;
      } else if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      } else if (!(field.name in defaults)) {
        defaults[field.name] = "";
      }
    }
  }

  return defaults;
}
