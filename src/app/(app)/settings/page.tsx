"use client";

import * as React from "react";
import { apiGet, apiSend, ApiError } from "@/lib/api-client";
import {
  Button, Badge, Card, CardContent, CardHeader, CardTitle, Field, Input,
  Spinner, ErrorNote,
} from "@/components/ui";
import { Download, KeyRound, Bot, Webhook, Trash2 } from "lucide-react";

interface AiConfig {
  id: string; taskType: string; modelId: string; fallbackModelId: string | null;
  requiresVision: boolean; maxTokens: number; temperature: string;
}

interface ApiKey { id: string; name: string; prefix: string; revokedAt: string | null; lastUsedAt: string | null }
interface Endpoint { id: string; url: string; eventTypes: string[] }
interface Project { id: string; name: string }

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>
      <AiModels />
      <ApiKeys />
      <Webhooks />
      <ExportSection />
    </div>
  );
}

function AiModels() {
  const [configs, setConfigs] = React.useState<AiConfig[] | null>(null);
  const [usage, setUsage] = React.useState<Record<string, { calls: number; costMicros: number }>>({});
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiGet<{ items: AiConfig[]; usage: Record<string, { calls: number; costMicros: number }> }>(
      "/api/v1/settings/ai-task-configs",
    ).then((r) => {
      setConfigs(r.items);
      setUsage(r.usage);
    });
  }, []);
  React.useEffect(load, [load]);

  async function saveModel(taskType: string, modelId: string) {
    setError(null);
    try {
      await apiSend("PATCH", `/api/v1/settings/ai-task-configs/${taskType}`, { modelId });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI task models (OpenRouter)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-stone-500">
          Each AI task type maps to an OpenRouter model — swap models without code changes. AI features ship in
          Phase 3; this registry and spend log are ready now. Vision-required tasks only accept vision-capable models.
        </p>
        {!configs ? (
          <Spinner />
        ) : (
          configs.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2">
              <span className="w-40 text-sm font-medium">{c.taskType.replace(/_/g, " ")}</span>
              {c.requiresVision ? <Badge variant="blue">vision</Badge> : null}
              <ModelInput initial={c.modelId} onSave={(m) => saveModel(c.taskType, m)} />
              <span className="text-xs text-stone-400">
                {usage[c.taskType] ? `${usage[c.taskType].calls} calls · $${(usage[c.taskType].costMicros / 1_000_000).toFixed(2)}` : "no usage"}
              </span>
            </div>
          ))
        )}
        <ErrorNote message={error} />
      </CardContent>
    </Card>
  );
}

function ModelInput({ initial, onSave }: { initial: string; onSave: (model: string) => void }) {
  const [value, setValue] = React.useState(initial);
  return (
    <div className="flex flex-1 items-center gap-2">
      <Input className="h-8 min-w-52 flex-1 text-xs" value={value} onChange={(e) => setValue(e.target.value)} />
      {value !== initial ? (
        <Button size="sm" onClick={() => onSave(value)}>Save</Button>
      ) : null}
    </div>
  );
}

function ApiKeys() {
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [name, setName] = React.useState("");
  const [created, setCreated] = React.useState<{ name: string; key: string } | null>(null);

  const load = React.useCallback(() => {
    apiGet<{ items: ApiKey[] }>("/api/v1/api-keys").then((r) => setKeys(r.items));
  }, []);
  React.useEffect(load, [load]);

  async function create() {
    const res = await apiSend<{ name: string; key: string }>("POST", "/api/v1/api-keys", { name, scopes: [] });
    setCreated(res);
    setName("");
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> API keys (machine access, e.g. n8n)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Key name, e.g. n8n" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim()} onClick={create}>Create</Button>
        </div>
        {created ? (
          <p className="break-all rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Copy this key now — it will not be shown again: <code className="font-mono">{created.key}</code>
          </p>
        ) : null}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {k.name} <code className="text-xs text-stone-400">{k.prefix}…</code>
              {k.revokedAt ? <Badge variant="red" className="ml-2">revoked</Badge> : null}
            </span>
            {!k.revokedAt ? (
              <Button variant="ghost" size="sm" onClick={async () => { await apiSend("DELETE", `/api/v1/api-keys/${k.id}`); load(); }}>
                Revoke
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Webhooks() {
  const [endpoints, setEndpoints] = React.useState<Endpoint[]>([]);
  const [url, setUrl] = React.useState("");

  const load = React.useCallback(() => {
    apiGet<{ items: Endpoint[] }>("/api/v1/webhook-endpoints").then((r) => setEndpoints(r.items));
  }, []);
  React.useEffect(load, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhooks (n8n notifications)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-stone-500">
          Signed events (task.due, inspection.due, insurance.expiring, budget.threshold, document.added) are POSTed
          here — point this at an n8n webhook node for email/SMS/Slack.
        </p>
        <div className="flex gap-2">
          <Input placeholder="https://n8n.example.com/webhook/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button
            disabled={!url.startsWith("http")}
            onClick={async () => {
              await apiSend("POST", "/api/v1/webhook-endpoints", { url, eventTypes: [] });
              setUrl("");
              load();
            }}
          >
            Add
          </Button>
        </div>
        {endpoints.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{e.url}</span>
            <Button variant="ghost" size="icon" aria-label="Remove endpoint"
              onClick={async () => { await apiSend("DELETE", `/api/v1/webhook-endpoints/${e.id}`); load(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ExportSection() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  React.useEffect(() => {
    apiGet<{ items: Project[] }>("/api/v1/projects").then((r) => setProjects(r.items));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-stone-500">Full project export as JSON — your data is never trapped.</p>
        {projects.map((p) => (
          <a key={p.id} href={`/api/v1/projects/${p.id}/export`} download className="block text-sm font-medium text-brand-700">
            Download “{p.name}” export →
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
