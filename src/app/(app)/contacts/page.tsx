"use client";

import * as React from "react";
import { apiGet, apiSend } from "@/lib/api-client";
import { formatDate, daysUntil } from "@/lib/dates";
import {
  Button, Badge, Card, CardContent, Dialog, Field, Input, Select, Textarea,
  Spinner, EmptyState, ErrorNote,
} from "@/components/ui";
import { Plus, Phone, Mail, ShieldAlert } from "lucide-react";

interface Insurance {
  id: string; type: string; insurer: string | null; policyNumber: string | null; expiryDate: string | null;
}

interface Contact {
  id: string; type: string; businessName: string; contactPerson: string | null;
  phone: string | null; email: string | null; tradeCategory: string | null;
  licenceNumber: string | null; licenceType: string | null; licenceExpiry: string | null;
  notes: string | null; insurances: Insurance[];
}

const CONTACT_TYPES = ["trade", "supplier", "consultant", "surveyor", "certifier", "inspector", "other"];
const INSURANCE_TYPES = ["public_liability", "workers_comp", "professional_indemnity", "construction_works", "domestic_building", "other"];

export default function ContactsPage() {
  const [contacts, setContacts] = React.useState<Contact[] | null>(null);
  const [editing, setEditing] = React.useState<Contact | "new" | null>(null);
  const [addingInsurance, setAddingInsurance] = React.useState<Contact | null>(null);

  const load = React.useCallback(() => {
    apiGet<{ items: Contact[] }>("/api/v1/contacts").then((r) => setContacts(r.items));
  }, []);
  React.useEffect(load, [load]);

  if (!contacts) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Contacts</h1>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <EmptyState title="No contacts yet" hint="Add trades, suppliers, your surveyor and certifiers — licences and insurances drive expiry alerts." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => {
            const licenceExpiring = c.licenceExpiry && daysUntil(c.licenceExpiry) <= 30;
            const insuranceExpiring = c.insurances.some((i) => i.expiryDate && daysUntil(i.expiryDate) <= 30);
            return (
              <Card key={c.id} className="cursor-pointer hover:border-brand-300" onClick={() => setEditing(c)}>
                <CardContent className="space-y-1.5 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.businessName}</p>
                      <p className="text-xs text-stone-500">
                        {c.tradeCategory || c.type}
                        {c.contactPerson ? ` · ${c.contactPerson}` : ""}
                      </p>
                    </div>
                    {(licenceExpiring || insuranceExpiring) && (
                      <Badge variant="amber">
                        <ShieldAlert className="mr-0.5 h-3 w-3" /> expiring
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-brand-700">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </a>
                    ) : null}
                    {c.email ? (
                      <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-brand-700">
                        <Mail className="h-3 w-3" /> {c.email}
                      </a>
                    ) : null}
                  </div>
                  {c.licenceNumber ? (
                    <p className="text-xs text-stone-500">
                      Licence {c.licenceNumber}
                      {c.licenceExpiry ? ` — expires ${formatDate(c.licenceExpiry)}` : ""}
                    </p>
                  ) : null}
                  {c.insurances.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.insurances.map((i) => (
                        <Badge
                          key={i.id}
                          variant={i.expiryDate && daysUntil(i.expiryDate) < 0 ? "red" : i.expiryDate && daysUntil(i.expiryDate) <= 30 ? "amber" : "default"}
                        >
                          {i.type.replace(/_/g, " ")}
                          {i.expiryDate ? ` → ${formatDate(i.expiryDate)}` : ""}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <button
                    className="text-xs font-medium text-brand-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingInsurance(c);
                    }}
                  >
                    + insurance
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing ? (
        <ContactDialog
          contact={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}
      {addingInsurance ? (
        <InsuranceDialog
          contact={addingInsurance}
          onClose={() => setAddingInsurance(null)}
          onSaved={() => { setAddingInsurance(null); load(); }}
        />
      ) : null}
    </div>
  );
}

function ContactDialog({ contact, onClose, onSaved }: { contact: Contact | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    type: contact?.type ?? "trade",
    businessName: contact?.businessName ?? "",
    contactPerson: contact?.contactPerson ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    tradeCategory: contact?.tradeCategory ?? "",
    licenceNumber: contact?.licenceNumber ?? "",
    licenceType: contact?.licenceType ?? "",
    licenceExpiry: contact?.licenceExpiry ?? "",
    notes: contact?.notes ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      contactPerson: form.contactPerson || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      tradeCategory: form.tradeCategory || undefined,
      licenceNumber: form.licenceNumber || undefined,
      licenceType: form.licenceType || undefined,
      licenceExpiry: form.licenceExpiry || null,
      notes: form.notes || undefined,
    };
    try {
      if (contact) await apiSend("PATCH", `/api/v1/contacts/${contact.id}`, body);
      else await apiSend("POST", "/api/v1/contacts", body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={contact ? "Edit contact" : "New contact"}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Business name *">
            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact person">
            <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </Field>
          <Field label="Trade category">
            <Input value={form.tradeCategory} onChange={(e) => setForm({ ...form, tradeCategory: e.target.value })} placeholder="e.g. Electrician" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Licence no.">
            <Input value={form.licenceNumber} onChange={(e) => setForm({ ...form, licenceNumber: e.target.value })} />
          </Field>
          <Field label="Licence type">
            <Input value={form.licenceType} onChange={(e) => setForm({ ...form, licenceType: e.target.value })} placeholder="e.g. A-Grade" />
          </Field>
          <Field label="Licence expiry">
            <Input type="date" value={form.licenceExpiry} onChange={(e) => setForm({ ...form, licenceExpiry: e.target.value })} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy || !form.businessName.trim()} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function InsuranceDialog({ contact, onClose, onSaved }: { contact: Contact; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({ type: "public_liability", insurer: "", policyNumber: "", expiryDate: "" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `/api/v1/contacts/${contact.id}/insurances`, {
        type: form.type,
        insurer: form.insurer || undefined,
        policyNumber: form.policyNumber || undefined,
        expiryDate: form.expiryDate || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Insurance — ${contact.businessName}`}>
      <div className="space-y-3">
        <Field label="Type">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {INSURANCE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Insurer">
            <Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
          </Field>
          <Field label="Policy number">
            <Input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          </Field>
        </div>
        <Field label="Expiry (drives alerts)">
          <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
