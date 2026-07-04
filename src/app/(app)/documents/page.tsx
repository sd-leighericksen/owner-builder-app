"use client";

import * as React from "react";
import { apiGet, apiSend, apiUpload } from "@/lib/api-client";
import { formatDate, daysUntil } from "@/lib/dates";
import {
  Button, Badge, Card, Dialog, Field, Input, Select, Textarea,
  Spinner, EmptyState, ErrorNote,
} from "@/components/ui";
import { Plus, FileText, Download, Search } from "lucide-react";

interface Doc {
  id: string; title: string; category: string; projectId: string | null;
  stageId: string | null; fileName: string | null; mimeType: string | null;
  notes: string | null; expiryDate: string | null; createdAt: string;
  storagePath: string | null;
}

interface Project { id: string; name: string }
interface Stage { id: string; name: string }

const CATEGORIES = [
  "permit", "plan", "engineering", "compliance_certificate", "insurance", "contract",
  "quote", "invoice_receipt", "warranty", "correspondence", "photo", "other",
];

export default function DocumentsPage() {
  const [docs, setDocs] = React.useState<Doc[] | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    apiGet<{ items: Doc[] }>(`/api/v1/documents?${params}`).then((r) => setDocs(r.items));
  }, [search, category]);

  React.useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  React.useEffect(() => {
    apiGet<{ items: Project[] }>("/api/v1/projects").then((r) => setProjects(r.items));
  }, []);

  async function download(doc: Doc) {
    const { url } = await apiGet<{ url: string }>(`/api/v1/documents/${doc.id}/download`);
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Documents</h1>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Upload
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input className="pl-9" placeholder="Search title, notes, filename…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="h-10 w-auto min-w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
          ))}
        </Select>
      </div>

      {!docs ? (
        <Spinner />
      ) : docs.length === 0 ? (
        <EmptyState title="No documents" hint="Permits, plans, contracts, certificates, warranties — keep everything in the vault." />
      ) : (
        <Card className="divide-y divide-stone-100">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-5 w-5 shrink-0 text-stone-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-stone-400">
                  {d.category.replace(/_/g, " ")}
                  {d.fileName ? ` · ${d.fileName}` : ""}
                  {d.notes ? ` · ${d.notes}` : ""}
                </p>
              </div>
              {d.expiryDate ? (
                <Badge variant={daysUntil(d.expiryDate) < 0 ? "red" : daysUntil(d.expiryDate) <= 30 ? "amber" : "default"}>
                  exp {formatDate(d.expiryDate)}
                </Badge>
              ) : null}
              {d.storagePath ? (
                <Button variant="ghost" size="icon" onClick={() => download(d)} aria-label="Download">
                  <Download className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </Card>
      )}

      {adding ? (
        <UploadDialog
          projects={projects}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }}
        />
      ) : null}
    </div>
  );
}

function UploadDialog({ projects, onClose, onSaved }: { projects: Project[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    title: "",
    category: "other",
    projectId: projects[0]?.id ?? "",
    stageId: "",
    notes: "",
    expiryDate: "",
  });
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!form.projectId) return setStages([]);
    apiGet<{ items: Stage[] }>(`/api/v1/projects/${form.projectId}/stages`).then((r) => setStages(r.items));
  }, [form.projectId]);

  async function save() {
    setBusy(true);
    setError(null);
    const meta = {
      title: form.title || file?.name || "Untitled",
      category: form.category,
      projectId: form.projectId || null,
      stageId: form.stageId || null,
      notes: form.notes || undefined,
      expiryDate: form.expiryDate || null,
    };
    try {
      if (file) {
        const fd = new FormData();
        fd.set("meta", JSON.stringify(meta));
        fd.set("file", file);
        await apiUpload("/api/v1/documents", fd);
      } else {
        await apiSend("POST", "/api/v1/documents", meta);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Upload document">
      <div className="space-y-3">
        <Field label="File">
          <input
            type="file"
            className="w-full text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !form.title) setForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") }));
            }}
          />
        </Field>
        <Field label="Title *">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </Field>
          <Field label="Expiry date (for permits/insurance)">
            <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project">
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, stageId: "" })}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })}>
              <option value="">None</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <ErrorNote message={error} />
        <div className="flex justify-end">
          <Button disabled={busy || (!form.title.trim() && !file)} onClick={save}>
            {busy ? "Uploading…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
