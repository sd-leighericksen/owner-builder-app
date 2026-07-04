"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/api-client";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/dates";
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Dialog, Field, Input,
  Select, Textarea, Spinner, EmptyState, ErrorNote,
} from "@/components/ui";
import { MoneyInput } from "@/components/money-input";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface CategorySummary {
  id: string; code: string; name: string; isContingency: boolean;
  budgetIncGst: number; committedIncGst: number; actualIncGst: number;
  remainingVsBudget: number; percentConsumed: number | null;
}

interface Summary {
  categories: CategorySummary[];
  totals: { budgetIncGst: number; committedIncGst: number; actualIncGst: number; actualExGst: number; actualGst: number; remainingVsBudget: number };
  contingency: { budgetIncGst: number; consumedByVariationsIncGst: number; remainingIncGst: number };
  gst: { paidGst: number; committedGst: number };
}

interface Txn {
  id: string; description: string; transactionDate: string; type: string;
  paymentStatus: string; budgetCategoryId: string | null;
  money: { amountExGst: number; gstAmount: number; amountIncGst: number; gstApplicable: boolean };
}

interface Variation {
  id: string; description: string; reason: string | null; status: string;
  budgetCategoryId: string | null; variationDate: string | null;
  money: { amountIncGst: number };
}

export default function BudgetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [txns, setTxns] = React.useState<Txn[]>([]);
  const [variations, setVariations] = React.useState<Variation[]>([]);
  const [tab, setTab] = React.useState<"summary" | "transactions" | "variations">("summary");
  const [adding, setAdding] = React.useState<"txn" | "variation" | null>(null);

  const load = React.useCallback(() => {
    apiGet<Summary>(`/api/v1/projects/${projectId}/budget`).then(setSummary);
    apiGet<{ items: Txn[] }>(`/api/v1/projects/${projectId}/transactions`).then((r) => setTxns(r.items));
    apiGet<{ items: Variation[] }>(`/api/v1/projects/${projectId}/variations`).then((r) => setVariations(r.items));
  }, [projectId]);

  React.useEffect(load, [load]);

  if (!summary) return <Spinner />;

  const catName = (id: string | null) => summary.categories.find((c) => c.id === id)?.name ?? "—";
  const contingencyPct =
    summary.contingency.budgetIncGst > 0
      ? Math.min(100, Math.round((summary.contingency.consumedByVariationsIncGst / summary.contingency.budgetIncGst) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Budget</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAdding("variation")}>
            <Plus className="h-4 w-4" /> Variation
          </Button>
          <Button size="sm" onClick={() => setAdding("txn")}>
            <Plus className="h-4 w-4" /> Cost
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
        {(["summary", "transactions", "variations"] as const).map((t) => (
          <button
            key={t}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm capitalize",
              tab === t ? "bg-white font-medium shadow-sm" : "text-stone-500",
            )}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Budget" value={formatCents(summary.totals.budgetIncGst)} />
            <Stat label="Committed" value={formatCents(summary.totals.committedIncGst)} sub="accepted quotes + approved variations" />
            <Stat label="Actual" value={formatCents(summary.totals.actualIncGst)} sub={`ex GST ${formatCents(summary.totals.actualExGst)}`} />
            <Stat label="GST paid" value={formatCents(summary.gst.paidGst)} sub="claimable component of actuals" />
          </div>

          {/* Contingency burn-down */}
          <Card>
            <CardHeader>
              <CardTitle>Contingency burn-down</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                <div
                  className={cn("h-full rounded-full", contingencyPct >= 90 ? "bg-red-500" : contingencyPct >= 60 ? "bg-amber-500" : "bg-brand-600")}
                  style={{ width: `${contingencyPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {formatCents(summary.contingency.consumedByVariationsIncGst)} of {formatCents(summary.contingency.budgetIncGst)} consumed
                by approved variations — {formatCents(summary.contingency.remainingIncGst)} remaining
              </p>
            </CardContent>
          </Card>

          {/* Per-category table */}
          <Card>
            <CardContent className="overflow-x-auto pt-4">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Budget</th>
                    <th className="pb-2 text-right font-medium">Committed</th>
                    <th className="pb-2 text-right font-medium">Actual</th>
                    <th className="pb-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((c) => (
                    <tr key={c.id} className="border-b border-stone-100">
                      <td className="py-2">
                        <span className="mr-1.5 text-xs text-stone-400">{c.code}</span>
                        {c.name}
                        {c.percentConsumed != null && c.percentConsumed >= 0.9 ? (
                          <Badge variant="red" className="ml-2">{Math.round(c.percentConsumed * 100)}%</Badge>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatCents(c.budgetIncGst)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCents(c.committedIncGst)}</td>
                      <td className="py-2 text-right tabular-nums">{formatCents(c.actualIncGst)}</td>
                      <td className={cn("py-2 text-right tabular-nums", c.remainingVsBudget < 0 && "font-semibold text-red-600")}>
                        {formatCents(c.remainingVsBudget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-stone-400">
                All amounts inc GST unless noted. Edit category budgets via the API or a future settings screen.
              </p>
            </CardContent>
          </Card>
        </>
      ) : tab === "transactions" ? (
        txns.length === 0 ? (
          <EmptyState title="No costs recorded yet" hint="Add invoices, receipts and deposits as they happen." />
        ) : (
          <Card className="divide-y divide-stone-100">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{t.description}</p>
                  <p className="text-xs text-stone-400">
                    {formatDate(t.transactionDate)} · {catName(t.budgetCategoryId)} · {t.type} · {t.paymentStatus.replace("_", " ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular-nums">{formatCents(t.money.amountIncGst)}</p>
                  <p className="text-xs text-stone-400">{t.money.gstApplicable ? `GST ${formatCents(t.money.gstAmount)}` : "GST-free"}</p>
                </div>
              </div>
            ))}
          </Card>
        )
      ) : variations.length === 0 ? (
        <EmptyState title="No variations" hint="Record scope or cost changes; approved variations adjust committed budget." />
      ) : (
        <Card className="divide-y divide-stone-100">
          {variations.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate">{v.description}</p>
                <p className="text-xs text-stone-400">
                  {v.variationDate ? formatDate(v.variationDate) + " · " : ""}
                  {catName(v.budgetCategoryId)}
                  {v.reason ? ` · ${v.reason}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium tabular-nums">{formatCents(v.money.amountIncGst)}</span>
                <VariationStatus id={v.id} status={v.status} onChanged={load} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {adding === "txn" ? (
        <TransactionDialog projectId={projectId} categories={summary.categories} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />
      ) : null}
      {adding === "variation" ? (
        <VariationDialog projectId={projectId} categories={summary.categories} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); load(); }} />
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-stone-500">{label}</p>
        <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
        {sub ? <p className="text-[11px] text-stone-400">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function VariationStatus({ id, status, onChanged }: { id: string; status: string; onChanged: () => void }) {
  return (
    <Select
      className="h-8 w-auto text-xs"
      value={status}
      onChange={async (e) => {
        await apiSend("PATCH", `/api/v1/variations/${id}`, { status: e.target.value });
        onChanged();
      }}
    >
      <option value="proposed">proposed</option>
      <option value="approved">approved</option>
      <option value="rejected">rejected</option>
    </Select>
  );
}

function TransactionDialog({
  projectId, categories, onClose, onSaved,
}: {
  projectId: string;
  categories: CategorySummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    description: "",
    transactionDate: todayISO(),
    budgetCategoryId: "",
    type: "invoice",
    paymentStatus: "unpaid",
    amountIncGst: null as number | null,
    gstApplicable: true,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `/api/v1/projects/${projectId}/transactions`, {
        description: form.description,
        transactionDate: form.transactionDate,
        budgetCategoryId: form.budgetCategoryId || null,
        type: form.type,
        paymentStatus: form.paymentStatus,
        money: { amountIncGst: form.amountIncGst ?? 0, gstApplicable: form.gstApplicable },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Record cost">
      <div className="space-y-3">
        <Field label="Description *">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Slab pour — ABC Concreting" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (inc GST) *">
            <MoneyInput valueCents={form.amountIncGst} onChangeCents={(v) => setForm({ ...form, amountIncGst: v })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.gstApplicable}
            onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })}
          />
          GST applies (10% component recorded)
        </label>
        <Field label="Budget category">
          <Select value={form.budgetCategoryId} onChange={(e) => setForm({ ...form, budgetCategoryId: e.target.value })}>
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} {c.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="invoice">Invoice</option>
              <option value="receipt">Receipt</option>
              <option value="deposit">Deposit</option>
              <option value="refund">Refund</option>
            </Select>
          </Field>
          <Field label="Payment status">
            <Select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
              <option value="unpaid">Unpaid</option>
              <option value="part_paid">Part paid</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy || !form.description.trim() || form.amountIncGst == null} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function VariationDialog({
  projectId, categories, onClose, onSaved,
}: {
  projectId: string;
  categories: CategorySummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    description: "",
    reason: "",
    budgetCategoryId: "",
    amountIncGst: null as number | null,
    variationDate: todayISO(),
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `/api/v1/projects/${projectId}/variations`, {
        description: form.description,
        reason: form.reason || undefined,
        budgetCategoryId: form.budgetCategoryId || null,
        variationDate: form.variationDate,
        money: { amountIncGst: form.amountIncGst ?? 0, gstApplicable: true },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="New variation">
      <div className="space-y-3">
        <Field label="Description *">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Upgrade to double glazing" />
        </Field>
        <Field label="Reason">
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost delta (inc GST, negative = saving) *">
            <MoneyInput valueCents={form.amountIncGst} onChangeCents={(v) => setForm({ ...form, amountIncGst: v })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={form.variationDate} onChange={(e) => setForm({ ...form, variationDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Affects category">
          <Select value={form.budgetCategoryId} onChange={(e) => setForm({ ...form, budgetCategoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} {c.name}</option>
            ))}
          </Select>
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy || !form.description.trim() || form.amountIncGst == null} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
