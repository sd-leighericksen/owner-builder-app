"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle, Badge, Spinner, EmptyState } from "@/components/ui";
import { AlertTriangle } from "lucide-react";

interface Dashboard {
  currentStage: { id: string; name: string; status: string } | null;
  stages: Array<{ id: string; name: string; status: string; sequence: number }>;
  nextTasks: Array<{ id: string; title: string; dueDate: string | null; status: string; isComplianceItem: boolean }>;
  overdueTasks: number;
  upcomingInspections: Array<{ id: string; type: string; required: boolean; bookedDate: string | null }>;
  budget: {
    totals: { budgetIncGst: number; committedIncGst: number; actualIncGst: number; remainingVsBudget: number };
    contingency: { budgetIncGst: number; remainingIncGst: number };
    gst: { paidGst: number };
  };
  expiring: Array<{ kind: string; id: string; label: string; expiryDate: string; daysRemaining: number }>;
}

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [project, setProject] = React.useState<{ name: string; address: string; totalBudget: number } | null>(null);

  React.useEffect(() => {
    apiGet<Dashboard>(`/api/v1/projects/${projectId}/dashboard`).then(setData).catch(console.error);
    apiGet<{ name: string; address: string; totalBudget: number }>(`/api/v1/projects/${projectId}`)
      .then(setProject)
      .catch(console.error);
  }, [projectId]);

  if (!data) return <Spinner />;

  const done = data.stages.filter((s) => s.status === "complete").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{project?.name ?? "Project"}</h1>
        <p className="text-sm text-stone-500">{project?.address}</p>
      </div>

      {/* Budget position */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Budget" value={formatCents(project?.totalBudget ?? data.budget.totals.budgetIncGst)} />
        <Stat label="Committed" value={formatCents(data.budget.totals.committedIncGst)} />
        <Stat label="Actual (inc GST)" value={formatCents(data.budget.totals.actualIncGst)} />
        <Stat
          label="Contingency left"
          value={formatCents(data.budget.contingency.remainingIncGst)}
          tone={data.budget.contingency.remainingIncGst < 0 ? "red" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current stage */}
        <Card>
          <CardHeader>
            <CardTitle>Build progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold">
              {data.currentStage ? data.currentStage.name : "No stages yet"}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${data.stages.length ? Math.round((done / data.stages.length) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-stone-500">
              {done} of {data.stages.length} stages complete
            </p>
          </CardContent>
        </Card>

        {/* Expiring items */}
        <Card>
          <CardHeader>
            <CardTitle>Expiring soon</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expiring.length === 0 ? (
              <p className="text-sm text-stone-400">Nothing expiring in the next 60 days.</p>
            ) : (
              <ul className="space-y-2">
                {data.expiring.slice(0, 6).map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{item.label}</span>
                    <Badge variant={item.daysRemaining < 0 ? "red" : item.daysRemaining <= 14 ? "amber" : "default"}>
                      {item.daysRemaining < 0 ? `${-item.daysRemaining}d overdue` : `${item.daysRemaining}d`}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Next tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Next tasks</span>
              {data.overdueTasks > 0 ? (
                <Badge variant="red">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {data.overdueTasks} overdue
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.nextTasks.length === 0 ? (
              <EmptyState title="No open tasks" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.nextTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">
                      {t.title}
                      {t.isComplianceItem ? <Badge variant="blue" className="ml-2">compliance</Badge> : null}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">{formatDate(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/projects/${projectId}/tasks`} className="mt-2 block text-xs font-medium text-brand-700">
              View all tasks →
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming inspections */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming inspections</CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingInspections.length === 0 ? (
              <p className="text-sm text-stone-400">No pending inspections.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {data.upcomingInspections.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">
                      {i.type}
                      {i.required ? <Badge variant="amber" className="ml-2">mandatory</Badge> : null}
                    </span>
                    <span className="shrink-0 text-xs text-stone-500">
                      {i.bookedDate ? formatDate(i.bookedDate) : "not booked"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-stone-500">{label}</p>
        <p className={`mt-1 text-lg font-bold ${tone === "red" ? "text-red-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
