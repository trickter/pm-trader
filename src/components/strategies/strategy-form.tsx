"use client";

import { StrategyScopeType, StrategyType } from "@prisma/client";
import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Select, TextInput } from "@/components/ui/primitives";
import {
  commonStrategySections,
  getStrategyFormDefaults,
  strategyFormDefinitions,
  strategyTypeOptions,
  type StrategyFormField,
} from "@/lib/strategy/form-config";

type StrategyFormProps = {
  action: (payload: FormData) => Promise<void>;
};

const checkboxClass = "flex items-center gap-2 rounded-2xl border border-[var(--line)] px-4 py-3 text-sm";

export function StrategyForm({ action }: StrategyFormProps) {
  const [selectedType, setSelectedType] = useState<StrategyType>(StrategyType.TWO_SIDED_RANGE_QUOTING);
  const [selectedScopeType, setSelectedScopeType] = useState<StrategyScopeType>(StrategyScopeType.DISCOVERY_QUERY);
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    getStrategyFormDefaults(StrategyType.TWO_SIDED_RANGE_QUOTING, StrategyScopeType.DISCOVERY_QUERY),
  );

  const definition = strategyFormDefinitions[selectedType];
  const scopeType = definition.supportedScopes.includes(selectedScopeType)
    ? selectedScopeType
    : definition.supportedScopes[0];
  const scopeDefinition = definition.scopeDefinitions[scopeType];
  const sections = useMemo(
    () => [...commonStrategySections, ...(scopeDefinition?.sections ?? []), ...definition.triggerSections],
    [definition.triggerSections, scopeDefinition],
  );

  const mergeDefaults = (
    nextType: StrategyType,
    nextScopeType: StrategyScopeType,
    current: Record<string, string | boolean>,
  ) => ({
    ...getStrategyFormDefaults(nextType, nextScopeType),
    name: String(current.name ?? ""),
    maxOrderSize: String(current.maxOrderSize ?? getStrategyFormDefaults(nextType, nextScopeType).maxOrderSize ?? ""),
    maxDailyTradeCount: String(
      current.maxDailyTradeCount ?? getStrategyFormDefaults(nextType, nextScopeType).maxDailyTradeCount ?? "",
    ),
    cooldownSeconds: String(
      current.cooldownSeconds ?? getStrategyFormDefaults(nextType, nextScopeType).cooldownSeconds ?? "",
    ),
    pauseOnStaleData: Boolean(current.pauseOnStaleData ?? true),
    cancelOpenOrdersOnStaleData: Boolean(current.cancelOpenOrdersOnStaleData ?? false),
    dryRun: Boolean(current.dryRun ?? true),
    enabled: Boolean(current.enabled ?? true),
    type: nextType,
    scopeType: nextScopeType,
  });

  const updateType = (nextType: StrategyType) => {
    const nextScopeType = strategyFormDefinitions[nextType].supportedScopes[0];
    setSelectedType(nextType);
    setSelectedScopeType(nextScopeType);
    setValues((current) => mergeDefaults(nextType, nextScopeType, current));
  };

  const updateScopeType = (nextScopeType: StrategyScopeType) => {
    setSelectedScopeType(nextScopeType);
    setValues((current) => mergeDefaults(selectedType, nextScopeType, current));
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
        <Select name="type" value={selectedType} onChange={(event) => updateType(event.target.value as StrategyType)}>
          {strategyTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </label>

      <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
        <p className="font-medium">{definition.label}</p>
        <p className="mt-2 text-[var(--muted)]">{definition.description}</p>
      </div>

      {definition.supportedScopes.length > 1 ? (
        <label className="text-sm md:col-span-2">
          <span className="mb-2 block text-[var(--muted)]">scope type</span>
          <Select
            name="scopeType"
            value={scopeType}
            onChange={(event) => updateScopeType(event.target.value as StrategyScopeType)}
          >
            {definition.supportedScopes.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <input type="hidden" name="scopeType" value={scopeType} />
      )}

      {scopeDefinition ? (
        <div className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm md:col-span-2">
          <p className="font-medium">{scopeDefinition.label}</p>
          <p className="mt-2 text-[var(--muted)]">{scopeDefinition.description}</p>
        </div>
      ) : null}

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
    return <input key={field.name} type="hidden" name={field.name} value={String(currentValue ?? field.defaultValue ?? "")} />;
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
