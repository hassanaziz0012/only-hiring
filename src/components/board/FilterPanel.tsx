"use client";

import { useState } from "react";
import type { AppliedFilter, Facet, FacetOption, Filters } from "./filters";

const COLLAPSED_ROLES = 8;

function FacetGroup({
  title,
  facet,
  options,
  filters,
  onChange,
  collapsible = false,
}: {
  title: string;
  facet: Facet;
  options: FacetOption[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = filters[facet];
  const shown =
    collapsible && !expanded
      ? options.filter((o, i) => i < COLLAPSED_ROLES || selected.includes(o.value))
      : options;
  const hiddenCount = options.length - shown.length;

  const toggle = (value: string) =>
    onChange({ [facet]: selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value] });

  return (
    <fieldset>
      <legend className="text-body font-bold">{title}</legend>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {shown.map((option) => {
          const isOn = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className="toggle"
              aria-pressed={isOn}
              disabled={!isOn && option.count === 0}
              onClick={() => toggle(option.value)}
            >
              <span>{option.label}</span>
              <span className="count">
                <span className="sr-only">, </span>
                {option.count}
                <span className="sr-only"> jobs</span>
              </span>
            </button>
          );
        })}
      </div>
      {collapsible && (hiddenCount > 0 || expanded) && (
        <button
          type="button"
          className="link mt-3 text-small font-bold"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer roles" : `Show ${hiddenCount} more roles`}
        </button>
      )}
    </fieldset>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" className="check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function AppliedGroup({
  value,
  count,
  onChange,
}: {
  value: AppliedFilter;
  count: number;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const choices: { value: AppliedFilter; label: string }[] = [
    { value: "only", label: "Only these" },
    { value: "hide", label: "Hide them" },
  ];
  return (
    <fieldset>
      <legend className="text-body font-bold">
        Jobs you applied to <span className="font-normal text-muted tabular-nums">({count})</span>
      </legend>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {choices.map((choice) => {
          const isOn = value === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              className="toggle"
              aria-pressed={isOn}
              onClick={() => onChange({ applied: isOn ? "all" : choice.value })}
            >
              <span>{choice.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FilterPanel({
  filters,
  onChange,
  options,
  scamCount,
  appliedCount,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  options: Record<Facet, FacetOption[]>;
  scamCount: number;
  appliedCount: number;
}) {
  return (
    <div className="space-y-9">
      {(appliedCount > 0 || filters.applied !== "all") && (
        <AppliedGroup value={filters.applied} count={appliedCount} onChange={onChange} />
      )}
      <FacetGroup title="Role" facet="roles" options={options.roles} filters={filters} onChange={onChange} collapsible />
      <FacetGroup title="Work mode" facet="modes" options={options.modes} filters={filters} onChange={onChange} />
      <FacetGroup title="Pay" facet="pay" options={options.pay} filters={filters} onChange={onChange} />
      <fieldset>
        <legend className="text-body font-bold">More</legend>
        <div className="mt-2">
          <CheckRow checked={filters.hideCommission} onChange={(v) => onChange({ hideCommission: v })}>
            Hide commission-only jobs
          </CheckRow>
          <CheckRow checked={filters.showScams} onChange={(v) => onChange({ showScams: v })}>
            Show likely scams
            {scamCount > 0 && <span className="text-muted"> ({scamCount})</span>}
          </CheckRow>
        </div>
      </fieldset>
    </div>
  );
}
