"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiSend, ApiError } from "@/lib/api-client";
import { Button, Card, CardContent, Field, Input, Select, ErrorNote } from "@/components/ui";
import { MoneyInput } from "@/components/money-input";

const STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

/** Project creation wizard (brief §5 P1.1). */
export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    address: "",
    lotPlanDetails: "",
    state: "VIC",
    startDate: "",
    targetCompletionDate: "",
    totalBudget: null as number | null,
    contingencyAmount: null as number | null,
    ownerBuilderPermitNo: "",
    buildingPermitNo: "",
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const project = await apiSend<{ id: string }>("POST", "/api/v1/projects", {
        name: form.name,
        address: form.address,
        lotPlanDetails: form.lotPlanDetails || undefined,
        state: form.state,
        startDate: form.startDate || undefined,
        targetCompletionDate: form.targetCompletionDate || undefined,
        totalBudget: form.totalBudget ?? 0,
        contingencyAmount: form.contingencyAmount ?? 0,
        ownerBuilderPermitNo: form.ownerBuilderPermitNo || undefined,
        buildingPermitNo: form.buildingPermitNo || undefined,
      });
      window.location.href = `/projects/${project.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project");
      setBusy(false);
    }
  }

  const steps = ["Property", "Dates & budget", "Permits"];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">New project</h1>
      <div className="flex gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-stone-200"}`} />
            <p className="mt-1 text-[11px] text-stone-500">{label}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-4">
          {step === 0 ? (
            <>
              <Field label="Project name *">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Smith St build" />
              </Field>
              <Field label="Site address *">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="12 Smith St, Melbourne VIC" />
              </Field>
              <Field label="Lot / plan details">
                <Input value={form.lotPlanDetails} onChange={(e) => set("lotPlanDetails", e.target.value)} placeholder="Lot 5, PS123456" />
              </Field>
              <Field label="State">
                <Select value={form.state} onChange={(e) => set("state", e.target.value)}>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-stone-400">
                  Build stages, budget categories and the compliance checklist are seeded for this state (VIC content ships first).
                </p>
              </Field>
            </>
          ) : step === 1 ? (
            <>
              <Field label="Start date">
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="Target completion">
                <Input type="date" value={form.targetCompletionDate} onChange={(e) => set("targetCompletionDate", e.target.value)} />
              </Field>
              <Field label="Total budget (inc GST)">
                <MoneyInput valueCents={form.totalBudget} onChangeCents={(v) => set("totalBudget", v)} />
              </Field>
              <Field label="Contingency (inc GST)">
                <MoneyInput valueCents={form.contingencyAmount} onChangeCents={(v) => set("contingencyAmount", v)} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Owner-builder permit no. (VIC: Certificate of Consent)">
                <Input value={form.ownerBuilderPermitNo} onChange={(e) => set("ownerBuilderPermitNo", e.target.value)} />
              </Field>
              <Field label="Building permit no.">
                <Input value={form.buildingPermitNo} onChange={(e) => set("buildingPermitNo", e.target.value)} />
              </Field>
              <p className="text-xs text-stone-400">
                Leave blank if not issued yet — the seeded compliance checklist will remind you.
              </p>
            </>
          )}

          <ErrorNote message={error} />

          <div className="flex justify-between pt-2">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                disabled={step === 0 && (!form.name.trim() || !form.address.trim())}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button disabled={busy} onClick={submit}>
                {busy ? "Creating…" : "Create project"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
