import { StrategyScopeType, StrategyType } from "@prisma/client";

export const strategyTypeOptions = Object.values(StrategyType);
export type StrategyTypeOption = StrategyType;

export const strategyScopeTypeOptions = Object.values(StrategyScopeType);
export type StrategyScopeTypeOption = StrategyScopeType;

type BaseField = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
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

type StrategyScopeDefinition = {
  label: string;
  description: string;
  sections: StrategyFormSection[];
};

type StrategyFormDefinition = {
  label: string;
  description: string;
  supportedScopes: StrategyScopeTypeOption[];
  scopeDefinitions: Partial<Record<StrategyScopeTypeOption, StrategyScopeDefinition>>;
  triggerSections: StrategyFormSection[];
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
    ],
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

const staticMarketScope: StrategyScopeDefinition = {
  label: "STATIC_MARKET",
  description: "固定市场策略。你明确指定 market 和 token，策略只在该目标上运行。",
  sections: [
    {
      key: "scope-static-market",
      title: "目标市场",
      fields: [
        {
          kind: "text",
          name: "marketId",
          label: "marketId",
          required: true,
        },
        {
          kind: "text",
          name: "tokenId",
          label: "tokenId",
          required: true,
        },
      ],
    },
  ],
};

const discoveryQueryScope: StrategyScopeDefinition = {
  label: "DISCOVERY_QUERY",
  description: "扫描型策略。先按条件筛选 market，再对候选 market 执行双边挂单。",
  sections: [
    {
      key: "scope-discovery",
      title: "市场扫描条件",
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
          label: "max spread (selection)",
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
  ],
};

export const strategyFormDefinitions: Record<StrategyTypeOption, StrategyFormDefinition> = {
  [StrategyType.THRESHOLD_BREAKOUT]: {
    label: StrategyType.THRESHOLD_BREAKOUT,
    description: "价格阈值突破后触发单边信号。",
    supportedScopes: [StrategyScopeType.STATIC_MARKET],
    scopeDefinitions: {
      [StrategyScopeType.STATIC_MARKET]: staticMarketScope,
    },
    triggerSections: [
      {
        key: "trigger-threshold-routing",
        title: "策略方向",
        fields: [
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
  [StrategyType.ORDERBOOK_IMBALANCE]: {
    label: StrategyType.ORDERBOOK_IMBALANCE,
    description: "按买一卖一深度失衡与点差约束触发单边信号。",
    supportedScopes: [StrategyScopeType.STATIC_MARKET],
    scopeDefinitions: {
      [StrategyScopeType.STATIC_MARKET]: staticMarketScope,
    },
    triggerSections: [
      {
        key: "trigger-imbalance-routing",
        title: "策略方向",
        fields: [
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
  [StrategyType.TWO_SIDED_RANGE_QUOTING]: {
    label: StrategyType.TWO_SIDED_RANGE_QUOTING,
    description: "扫描候选 market 后，在符合条件的市场上做双边区间挂单。",
    supportedScopes: [StrategyScopeType.DISCOVERY_QUERY],
    scopeDefinitions: {
      [StrategyScopeType.DISCOVERY_QUERY]: discoveryQueryScope,
    },
    triggerSections: [
      {
        key: "range-pricing",
        title: "区间价格参数",
        fields: [
          {
            kind: "hidden",
            name: "side",
            label: "side",
            defaultValue: "BUY",
          },
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
        key: "range-quote-guard",
        title: "WebSocket 报价约束",
        fields: [
          {
            kind: "number",
            name: "maxSpread",
            label: "max spread (execution)",
            step: "0.01",
            min: "0",
            max: "1",
            defaultValue: "0.08",
          },
          {
            kind: "number",
            name: "minTopLevelSize",
            label: "min top level size",
            step: "1",
            min: "0",
            defaultValue: "0",
          },
          {
            kind: "number",
            name: "maxQuoteAgeMs",
            label: "max quote age (ms)",
            step: "100",
            min: "100",
            defaultValue: "5000",
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

export function getStrategyFormDefaults(type: StrategyTypeOption, scopeType?: StrategyScopeTypeOption) {
  const definition = strategyFormDefinitions[type];
  const resolvedScope = scopeType ?? definition.supportedScopes[0];
  const scopeDefinition = definition.scopeDefinitions[resolvedScope];
  const sections = [
    ...commonStrategySections,
    ...(scopeDefinition?.sections ?? []),
    ...definition.triggerSections,
  ];
  const defaults: Record<string, string | boolean> = {
    type,
    scopeType: resolvedScope,
  };

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
