"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { apiGet, apiSend } from "@/lib/api-client";
import { formatDate, todayISO } from "@/lib/dates";
import { Button, Badge, Card, Dialog, Field, Input, Select, Textarea, Spinner, EmptyState, ErrorNote } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Plus, GripVertical, AlertTriangle, ShieldCheck } from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  stageId: string | null;
  dueDate: string | null;
  assignedContactId: string | null;
  isComplianceItem: boolean;
  blockedByOpenDependencies: string[];
}

interface Stage {
  id: string;
  name: string;
  sequence: number;
  status: string;
}

interface Contact {
  id: string;
  businessName: string;
  tradeCategory: string | null;
}

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

export default function TasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [view, setView] = React.useState<"board" | "list">("board");
  const [filterStage, setFilterStage] = React.useState("");
  const [filterContact, setFilterContact] = React.useState("");
  const [filterDue, setFilterDue] = React.useState("");
  const [editing, setEditing] = React.useState<Task | "new" | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const load = React.useCallback(() => {
    apiGet<{ items: Task[] }>(`/api/v1/projects/${projectId}/tasks`).then((r) => setTasks(r.items));
    apiGet<{ items: Stage[] }>(`/api/v1/projects/${projectId}/stages`).then((r) => setStages(r.items));
    apiGet<{ items: Contact[] }>(`/api/v1/contacts`).then((r) => setContacts(r.items));
  }, [projectId]);

  React.useEffect(load, [load]);

  if (!tasks) return <Spinner />;

  const today = todayISO();
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const filtered = tasks.filter((t) => {
    if (filterStage && t.stageId !== filterStage) return false;
    if (filterContact && t.assignedContactId !== filterContact) return false;
    if (filterDue === "overdue" && !(t.dueDate && t.dueDate < today && t.status !== "done")) return false;
    if (filterDue === "week" && !(t.dueDate && t.dueDate <= weekAhead)) return false;
    return true;
  });

  async function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const newStatus = event.over?.id as TaskStatus | undefined;
    if (!newStatus || !COLUMNS.some((c) => c.status === newStatus)) return;
    const task = tasks!.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks((prev) => prev!.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await apiSend("PATCH", `/api/v1/tasks/${taskId}`, { status: newStatus });
    } catch {
      load(); // revert to server state
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Tasks</h1>
        <div className="flex gap-2">
          <Button variant={view === "board" ? "default" : "outline"} size="sm" onClick={() => setView("board")}>
            Board
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            List
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select className="h-9 w-auto min-w-36" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select className="h-9 w-auto min-w-36" value={filterContact} onChange={(e) => setFilterContact(e.target.value)}>
          <option value="">All trades</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.businessName}</option>
          ))}
        </Select>
        <Select className="h-9 w-auto min-w-36" value={filterDue} onChange={(e) => setFilterDue(e.target.value)}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due this week</option>
        </Select>
      </div>

      {view === "board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <Column
                key={col.status}
                column={col}
                tasks={filtered.filter((t) => t.status === col.status)}
                today={today}
                onOpen={setEditing}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <ListView stages={stages} tasks={filtered} today={today} onOpen={setEditing} />
      )}

      {editing ? (
        <TaskDialog
          projectId={projectId}
          task={editing === "new" ? null : editing}
          stages={stages}
          contacts={contacts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function Column({
  column,
  tasks,
  today,
  onOpen,
}: {
  column: { status: TaskStatus; label: string };
  tasks: Task[];
  today: string;
  onOpen: (t: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-xl bg-stone-100 p-2 transition-colors", isOver && "bg-brand-100")}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{column.label}</span>
        <Badge>{tasks.length}</Badge>
      </div>
      <div className="min-h-16 space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} today={today} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, today, onOpen }: { task: Task; today: string; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const overdue = task.dueDate && task.dueDate < today && task.status !== "done";
  return (
    <Card
      ref={setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn("cursor-pointer p-2.5", isDragging && "z-30 opacity-80 shadow-lg")}
      onClick={() => onOpen(task)}
    >
      <div className="flex items-start gap-1.5">
        <button
          className="mt-0.5 shrink-0 cursor-grab touch-none text-stone-300 hover:text-stone-500"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag task"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.isComplianceItem ? (
              <Badge variant="blue">
                <ShieldCheck className="mr-0.5 h-3 w-3" /> compliance
              </Badge>
            ) : null}
            {task.dueDate ? (
              <span className={cn("text-xs", overdue ? "font-semibold text-red-600" : "text-stone-400")}>
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task.blockedByOpenDependencies.length > 0 ? (
              <Badge variant="amber" title={`Waiting on: ${task.blockedByOpenDependencies.join(", ")}`}>
                <AlertTriangle className="mr-0.5 h-3 w-3" />
                {task.blockedByOpenDependencies.length} dep
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ListView({
  stages,
  tasks,
  today,
  onOpen,
}: {
  stages: Stage[];
  tasks: Task[];
  today: string;
  onOpen: (t: Task) => void;
}) {
  const groups: Array<{ stage: Stage | null; tasks: Task[] }> = [
    ...stages.map((s) => ({ stage: s as Stage | null, tasks: tasks.filter((t) => t.stageId === s.id) })),
    { stage: null, tasks: tasks.filter((t) => !t.stageId) },
  ].filter((g) => g.tasks.length > 0);

  if (groups.length === 0) return <EmptyState title="No tasks match the filters" />;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.stage?.id ?? "none"}>
          <h3 className="mb-1 text-sm font-semibold text-stone-600">{g.stage?.name ?? "No stage"}</h3>
          <Card className="divide-y divide-stone-100">
            {g.tasks.map((t) => {
              const overdue = t.dueDate && t.dueDate < today && t.status !== "done";
              return (
                <button
                  key={t.id}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
                  onClick={() => onOpen(t)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {t.title}
                    {t.blockedByOpenDependencies.length > 0 ? (
                      <span className="ml-2 text-xs text-amber-600">
                        ⚠ waiting on {t.blockedByOpenDependencies.join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("shrink-0 text-xs", overdue ? "font-semibold text-red-600" : "text-stone-400")}>
                    {t.dueDate ? formatDate(t.dueDate) : ""}
                  </span>
                  <Badge
                    variant={t.status === "done" ? "green" : t.status === "blocked" ? "red" : t.status === "in_progress" ? "blue" : "default"}
                  >
                    {t.status.replace("_", " ")}
                  </Badge>
                </button>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

function TaskDialog({
  projectId,
  task,
  stages,
  contacts,
  onClose,
  onSaved,
}: {
  projectId: string;
  task: Task | null;
  stages: Stage[];
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    stageId: task?.stageId ?? "",
    dueDate: task?.dueDate ?? "",
    assignedContactId: task?.assignedContactId ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const body = {
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      stageId: form.stageId || null,
      dueDate: form.dueDate || null,
      assignedContactId: form.assignedContactId || null,
    };
    try {
      if (task) await apiSend("PATCH", `/api/v1/tasks/${task.id}`, body);
      else await apiSend("POST", `/api/v1/projects/${projectId}/tasks`, body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/v1/tasks/${task.id}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={task ? "Edit task" : "New task"}>
      <div className="space-y-3">
        <Field label="Title *">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
              {COLUMNS.map((c) => (
                <option key={c.status} value={c.status}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })}>
              <option value="">None</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned to">
            <Select value={form.assignedContactId} onChange={(e) => setForm({ ...form, assignedContactId: e.target.value })}>
              <option value="">Unassigned</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.businessName}</option>
              ))}
            </Select>
          </Field>
        </div>
        {task?.blockedByOpenDependencies.length ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Waiting on: {task.blockedByOpenDependencies.join(", ")}
          </p>
        ) : null}
        <ErrorNote message={error} />
        <div className="flex justify-between pt-1">
          {task ? (
            <Button variant="destructive" size="sm" disabled={busy} onClick={remove}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={busy || !form.title.trim()} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
