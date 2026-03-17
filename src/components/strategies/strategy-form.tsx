"use client";

import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Select, TextInput } from "@/components/ui/primitives";
import {
  commonStrategySections,
  getStrategyFormDefaults,
  strategyFormDefinitions,
  strategyTypeOptions,
  type StrategyFormField,
  type StrategyTypeOption,
} from "@/lib/strategy/form-config";

type StrategyFormProps = {
  action: (payload: FormData) => Promise<void>;
};

const checkboxClass = "flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm";

export function StrategyForm({ action }: StrategyFormProps) {
  const [selectedType, setSelectedType] = useState<StrategyTypeOption>("TWO_SIDED_RANGE_QUOTING");
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    getStrategyFormDefaults("TWO_SIDED_RANGE_QUOTING"),
  );

  const definition = strategyFormDefinitions[selectedType];
  const sections = useMemo(
    () => [...commonStrategySections, ...definition.sections],
    [definition.sections],
  );

  const updateType = (nextType: StrategyTypeOption) => {
    setSelectedType(nextType);
    setValues((current) => ({
      ...current,
      ...getStrategyFormDefaults(nextType),
      name: String(current.name ?? ""),
      marketId: String(current.marketId ?? ""),
      maxOrderSize: String(current.maxOrderSize ?? getStrategyFormDefaults(nextType).maxOrderSize ?? ""),
      maxDailyTradeCount: String(current.maxDailyTradeCount ?? getStrategyFormDefaults(nextType).maxDailyTradeCount ?? ""),
      cooldownSeconds: String(current.cooldownSeconds ?? getStrategyFormDefaults(nextType).cooldownSeconds ?? ""),
      pauseOnStaleData: Boolean(current.pauseOnStaleData ?? true),
      cancelOpenOrdersOnStaleData: Boolean(current.cancelOpenOrdersOnStaleData ?? false),
      dryRun: Boolean(current.dryRun ?? true),
      enabled: Boolean(current.enabled ?? true),
      type: nextType,
    }));
  };

  const setValue = (name: string, value: string | boolean) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
  };

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm">
        <span className="mb-2 block text-[var(--muted)]">type</span>
        <Select
          name="type"
          value={selectedType}
          onChange={(event) => updateType(event.target.value as StrategyTypeOption)}
        >
          {strategyTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </label>
      <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm md:col-span-1">
        <p className="font-medium">{definition.label}</p>
        <p className="mt-2 text-[var(--muted)]">{definition.description}</p>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="contents">
          {section.title ? (
            <div className="md:col-span-2 mt-2 border-t border-[var(--line)] pt-3">
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">{section.title}</p>
              {section.description ? <p className="text-xs text-[var(--muted)]">{section.description}</p> : null}
            </div>
          ) : null}
          {section.fields.map((field) => renderField(field, values[field.name], setValue))}
        </div>
      ))}

      <div className="md:col-span-2">
        <SubmitButton pendingLabel="保存中...">保存策略</SubmitButton>
      </div>
    </form>
  );
}

function renderField(
  field: StrategyFormField,
  currentValue: string | boolean | undefined,
  setValue: (name: string, value: string | boolean) => void,
) {
  if (field.kind === "hidden") {
    return (
      <input
        key={field.name}
        type="hidden"
        name={field.name}
        value={String(currentValue ?? field.defaultValue ?? "")}
      />
    );
  }

  if (field.kind === "checkbox") {
    return (
      <label key={field.name} className={checkboxClass}>
        <input
          type="checkbox"
          name={field.name}
          checked={Boolean(currentValue)}
          onChange={(event) => setValue(field.name, event.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <label key={field.name} className="text-sm">
        <span className="mb-2 block text-[var(--muted)]">{field.label}</span>
        <Select
          name={field.name}
          value={String(currentValue ?? field.defaultValue ?? "")}
          onChange={(event) => setValue(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {field.hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{field.hint}</span> : null}
      </label>
    );
  }

  return (
    <label key={field.name} className="text-sm">
      <span className="mb-2 block text-[var(--muted)]">{field.label}</span>
      <TextInput
        type={field.kind}
        name={field.name}
        value={String(currentValue ?? field.defaultValue ?? "")}
        onChange={(event) => setValue(field.name, event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        step={field.step}
        min={field.min}
        max={field.max}
      />
      {field.hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{field.hint}</span> : null}
    </label>
  );
}
