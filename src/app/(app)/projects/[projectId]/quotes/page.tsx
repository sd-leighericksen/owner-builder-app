"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/api-client";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import {
  Button, Badge, Card, CardContent, Dialog, Field, Input, Select, Textarea,
  Spinner, EmptyState, ErrorNote,
} from "@/components/ui";
import { MoneyInput } from "@/components/money-input";
import { Plus, Scale } from "lucide-react";
import { cn } from "@/lib/cn";

interface Quote {
  id: string; contactId: string; contactName: string; budgetCategoryId: string | null;
  scopeOfWork: string | null; status: "requested" | "received" | "accepted" | "declined";
  validUntil: string | null; notes: string | null;
  money: { amountExGst: number; gstAmount: number; amountIncGst: number; gstApplicable: boolean };
}

interface Category { id: string; code: string; name: string }
interface Contact { id: string; businessName: string }

const STATUS_BADGE: Record<Quote["status"], "default" | "blue" | "green" | "red"> = {
  requested: "default",
  received: "blue",
  accepted: "green",
  declined: "red",
};

export default function QuotesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [quotes, setQuotes] = React.useState<Quote[] | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [compareCategory, setCompareCategory] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    apiGet<{ items: Quote[] }>(`/api/v1/projects/${projectId}/quotes`).then((r) => setQuotes(r.items));
    apiGet<{ items: Category[] }>(`/api/v1/projects/${projectId}/budget-categories`).then((r) => setCategories(r.items));
    apiGet<{ items: Contact[] }>(`/api/v1/contacts`).then((r) => setContacts(r.items));
  }, [projectId]);

  React.useEffect(load, [load]);

  if (!quotes) return <Spinner />;

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const comparing = compareCategory
    ? quotes
        .filter((q) => q.budgetCategoryId === compareCategory)
        .sort((a, b) => a.money.amountIncGst - b.money.amountIncGst)
    : null;

  async function setStatus(id: string, status: string) {
    await apiSend("PATCH", `/api/v1/quotes/${id}`, { status });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Quotes</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Quote
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-stone-400" />
        <Select className="h-9 w-auto min-w-48" value={compareCategory} onChange={(e) => setCompareCategory(e.target.value)}>
          <option value="">Compare by scope (pick category)…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.code} {c.name}</option>
          ))}
        </Select>
      </div>

      {comparing ? (
        comparing.length === 0 ? (
          <EmptyState title="No quotes for this scope yet" hint="Aim for three quotes before accepting one." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparing.map((q, i) => (
              <Card key={q.id} className={cn(i === 0 && "border-brand-400 ring-1 ring-brand-200")}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{q.contactName}</p>
                    {i === 0 ? <Badge variant="green">cheapest</Badge> : null}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">{formatCents(q.money.amountIncGst)}</p>
                  <p className="text-xs text-stone-500">
                    ex GST {formatCents(q.money.amountExGst)} · GST {formatCents(q.money.gstAmount)}
                  </p>
                  {q.scopeOfWork ? <p className="line-clamp-3 text-xs text-stone-500">{q.scopeOfWork}</p> : null}
                  {q.validUntil ? <p className="text-xs text-stone-400">Valid until {formatDate(q.validUntil)}</p> : null}
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant={STATUS_BADGE[q.status]}>{q.status}</Badge>
                    {q.status === "received" ? (
                      <Button size="sm" onClick={() => setStatus(q.id, "accepted")}>Accept</Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : quotes.length === 0 ? (
        <EmptyState title="No quotes yet" hint="Record quotes per scope to enable 3-way comparison." />
      ) : (
        <Card className="divide-y divide-stone-100">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{q.contactName}</p>
                <p className="truncate text-xs text-stone-400">
                  {catName(q.budgetCategoryId)}
                  {q.scopeOfWork ? ` · ${q.scopeOfWork}` : ""}
                  {q.validUntil ? ` · valid to ${formatDate(q.validUntil)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-medium tabular-nums">{formatCents(q.money.amountIncGst)}</span>
                <Select className="h-8 w-auto text-xs" value={q.status} onChange={(e) => setStatus(q.id, e.target.value)}>
                  <option value="requested">requested</option>
                  <option value="received">received</option>
                  <option value="accepted">accepted</option>
                  <option value="declined">declined</option>
                </Select>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-xs text-stone-400">Accepted quotes count as committed budget for their category.</p>

      {adding ? (
        <QuoteDialog
          projectId={projectId}
          categories={categories}
          contacts={contacts}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      ) : null}
    </div>
  );
}

function QuoteDialog({
  projectId, categories, contacts, onClose, onSaved,
}: {
  projectId: string;
  categories: Category[];
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    contactId: "",
    budgetCategoryId: "",
    scopeOfWork: "",
    status: "received",
    amountIncGst: null as number | null,
    gstApplicable: true,
    validUntil: "",
    notes: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `/api/v1/projects/${projectId}/quotes`, {
        contactId: form.contactId,
        budgetCategoryId: form.budgetCategoryId || null,
        scopeOfWork: form.scopeOfWork || undefined,
        status: form.status,
        money: { amountIncGst: form.amountIncGst ?? 0, gstApplicable: form.gstApplicable },
        validUntil: form.validUntil || null,
        notes: form.notes || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="New quote">
      <div className="space-y-3">
        <Field label="Contact (trade/supplier) *">
          <Select value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
            <option value="">Select…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.businessName}</option>
            ))}
          </Select>
          {contacts.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">Add the trade under Contacts first.</p>
          ) : null}
        </Field>
        <Field label="Scope / budget category">
          <Select value={form.budgetCategoryId} onChange={(e) => setForm({ ...form, budgetCategoryId: e.target.value })}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.code} {c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Scope of work">
          <Textarea value={form.scopeOfWork} onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (inc GST) *">
            <MoneyInput valueCents={form.amountIncGst} onChangeCents={(v) => setForm({ ...form, amountIncGst: v })} />
          </Field>
          <Field label="Valid until">
            <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.gstApplicable}
            onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })}
          />
          GST applies
        </label>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy || !form.contactId || form.amountIncGst == null} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
