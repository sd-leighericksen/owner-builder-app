"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, KanbanSquare, Wallet, FileText, Users, BookOpen,
  Settings, Menu, ReceiptText, HardHat,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { apiGet } from "@/lib/api-client";

interface Project {
  id: string;
  name: string;
}

/**
 * Responsive app shell: sidebar on desktop, bottom tab bar on mobile (the
 * owner uses this on-site from a phone — brief §2.4).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const projectMatch = pathname.match(/\/projects\/([0-9a-f-]{36})/);
  const projectId = projectMatch?.[1] ?? null;

  React.useEffect(() => {
    apiGet<{ items: Project[] }>("/api/v1/projects")
      .then((r) => setProjects(r.items))
      .catch(() => setProjects([]));
  }, []);

  const projectNav = projectId
    ? [
        { href: `/projects/${projectId}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: `/projects/${projectId}/tasks`, label: "Tasks", icon: KanbanSquare },
        { href: `/projects/${projectId}/budget`, label: "Budget", icon: Wallet },
        { href: `/projects/${projectId}/quotes`, label: "Quotes", icon: ReceiptText },
        { href: `/projects/${projectId}/diary`, label: "Diary", icon: BookOpen },
      ]
    : [];
  const globalNav = [
    { href: "/contacts", label: "Contacts", icon: Users },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200 bg-white sm:flex">
        <div className="flex items-center gap-2 px-4 py-4">
          <HardHat className="h-6 w-6 text-brand-600" />
          <span className="text-sm font-bold">Owner-Builder</span>
        </div>
        <div className="px-3 pb-2">
          <select
            className="h-9 w-full rounded-lg border border-stone-300 bg-white px-2 text-sm"
            value={projectId ?? ""}
            onChange={(e) => {
              if (e.target.value === "__new__") router.push("/projects/new");
              else if (e.target.value) router.push(`/projects/${e.target.value}`);
            }}
          >
            <option value="" disabled>
              Select project…
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new__">+ New project</option>
          </select>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {[...projectNav, ...globalNav].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                isActive(item.href, "exact" in item && item.exact === true)
                  ? "bg-brand-50 font-medium text-brand-800"
                  : "text-stone-600 hover:bg-stone-100",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <Disclaimer />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 sm:pb-8">{children}</main>
        <div className="sm:hidden">
          <Disclaimer />
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-stone-200 bg-white sm:hidden">
        {(projectId
          ? [...projectNav.slice(0, 4)]
          : [{ href: "/", label: "Home", icon: LayoutDashboard, exact: true }, ...globalNav.slice(0, 2)]
        ).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
              isActive(item.href, "exact" in item && item.exact === true) ? "text-brand-700" : "text-stone-500",
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-stone-500"
          onClick={() => setMoreOpen((v) => !v)}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 grid grid-cols-1 gap-1">
              {[
                ...(projectId ? [{ href: `/projects/${projectId}/diary`, label: "Site diary", icon: BookOpen }] : []),
                ...globalNav,
                { href: "/projects/new", label: "New project", icon: HardHat },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-stone-700 hover:bg-stone-100"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Persistent, unobtrusive compliance disclaimer (brief §2.6). */
function Disclaimer() {
  return (
    <p className="px-4 py-3 text-[10px] leading-snug text-stone-400">
      Checklist aid only — not legal advice. Verify requirements with the{" "}
      <a href="https://www.vba.vic.gov.au" target="_blank" rel="noreferrer" className="underline">
        VBA
      </a>{" "}
      and your relevant building surveyor.
    </p>
  );
}
