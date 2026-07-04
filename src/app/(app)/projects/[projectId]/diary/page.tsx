"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { apiGet, apiSend, apiUpload } from "@/lib/api-client";
import { formatDate, todayISO } from "@/lib/dates";
import { resizeImage } from "@/lib/resize-image";
import {
  Button, Badge, Card, CardContent, Field, Input, Select, Textarea,
  Spinner, EmptyState, ErrorNote,
} from "@/components/ui";
import { Camera, BookOpen, Images } from "lucide-react";
import { cn } from "@/lib/cn";

interface Photo {
  id: string; caption: string | null; takenAt: string | null;
  url: string | null; thumbnailUrl: string | null; stageId: string | null;
}

interface Entry {
  id: string; entryDate: string; weather: string | null; notes: string | null;
  peopleOnSite: string | null; entryType: string; revisionOfId: string | null;
  photos: Photo[];
}

export default function DiaryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [tab, setTab] = React.useState<"diary" | "timeline">("diary");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiGet<{ items: Entry[] }>(`/api/v1/projects/${projectId}/diary`).then((r) => setEntries(r.items));
    apiGet<{ items: Photo[] }>(`/api/v1/projects/${projectId}/photos`).then((r) => setPhotos(r.items));
  }, [projectId]);

  React.useEffect(load, [load]);

  if (!entries) return <Spinner />;

  // Photo timeline grouped by day (chronological project record).
  const byDay = new Map<string, Photo[]>();
  for (const p of photos) {
    const day = p.takenAt ? p.takenAt.slice(0, 10) : "unknown";
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Site diary</h1>
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1">
          <button
            className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm", tab === "diary" ? "bg-white font-medium shadow-sm" : "text-stone-500")}
            onClick={() => setTab("diary")}
          >
            <BookOpen className="h-4 w-4" /> Diary
          </button>
          <button
            className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm", tab === "timeline" ? "bg-white font-medium shadow-sm" : "text-stone-500")}
            onClick={() => setTab("timeline")}
          >
            <Images className="h-4 w-4" /> Photos
          </button>
        </div>
      </div>

      {/* Hero interaction: one-tap photo + note (brief §4 diary_entries). */}
      <QuickCapture projectId={projectId} onSaved={load} onError={setError} />
      <ErrorNote message={error} />

      {tab === "diary" ? (
        entries.length === 0 ? (
          <EmptyState title="No diary entries yet" hint="Entries are immutable once saved — edits create revisions. Perfect evidence years later." />
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{formatDate(e.entryDate)}</p>
                    <div className="flex gap-1">
                      {e.entryType !== "general" ? <Badge variant={e.entryType === "incident" ? "red" : "blue"}>{e.entryType}</Badge> : null}
                      {e.revisionOfId ? <Badge>revised</Badge> : null}
                      {e.weather ? <Badge>{e.weather}</Badge> : null}
                    </div>
                  </div>
                  {e.notes ? <p className="whitespace-pre-wrap text-sm">{e.notes}</p> : null}
                  {e.peopleOnSite ? <p className="text-xs text-stone-500">On site: {e.peopleOnSite}</p> : null}
                  {e.photos.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto">
                      {e.photos.map((p) => (
                        <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumbnailUrl ?? ""} alt={p.caption ?? "site photo"} className="h-20 w-20 rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : days.length === 0 ? (
        <EmptyState title="No photos yet" hint="Photos build a chronological record of the build." />
      ) : (
        <div className="space-y-4">
          {days.map(([day, dayPhotos]) => (
            <div key={day}>
              <h3 className="mb-1.5 text-sm font-semibold text-stone-600">
                {day === "unknown" ? "Unknown date" : formatDate(day)}
              </h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {dayPhotos.map((p) => (
                  <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnailUrl ?? ""}
                      alt={p.caption ?? "site photo"}
                      className="aspect-square w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickCapture({
  projectId,
  onSaved,
  onError,
}: {
  projectId: string;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [note, setNote] = React.useState("");
  const [weather, setWeather] = React.useState("");
  const [entryType, setEntryType] = React.useState("general");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    onError(null);
    try {
      // 1. Upload photos (client-side resized) → photo ids
      const photoIds: string[] = [];
      for (const file of files) {
        const { original, thumbnail } = await resizeImage(file);
        const fd = new FormData();
        fd.set("file", new File([original], file.name, { type: original.type || file.type }));
        fd.set("thumbnail", new File([thumbnail], `thumb-${file.name}`, { type: "image/jpeg" }));
        fd.set("takenAt", new Date(file.lastModified).toISOString());
        const photo = await apiUpload<{ id: string }>(`/api/v1/projects/${projectId}/photos`, fd);
        photoIds.push(photo.id);
      }
      // 2. Create the diary entry linking the photos
      await apiSend("POST", `/api/v1/projects/${projectId}/diary`, {
        entryDate: todayISO(),
        notes: note || undefined,
        weather: weather || undefined,
        entryType,
        photoIds,
      });
      setNote("");
      setWeather("");
      setEntryType("general");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-brand-200 bg-brand-50/50">
      <CardContent className="space-y-2 pt-4">
        <Textarea
          placeholder="What happened on site today?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="bg-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => setFiles([...(e.target.files ?? [])])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" />
            {files.length > 0 ? `${files.length} photo${files.length > 1 ? "s" : ""}` : "Add photos"}
          </Button>
          <Field label="" className="w-28">
            <Input className="h-8 bg-white text-xs" placeholder="Weather" value={weather} onChange={(e) => setWeather(e.target.value)} />
          </Field>
          <Select className="h-8 w-auto bg-white text-xs" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
            <option value="general">General</option>
            <option value="incident">Incident</option>
            <option value="delivery">Delivery</option>
          </Select>
          <div className="ml-auto">
            <Button size="sm" disabled={busy || (note.trim() === "" && files.length === 0)} onClick={save}>
              {busy ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
