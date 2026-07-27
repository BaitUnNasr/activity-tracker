"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardList,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/src/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { HeaderGlow, IconChip } from "@/src/components/page-ui";
import {
  createCategory,
  createSubcategory,
  createTask,
  deleteCategory,
  deleteSubcategory,
  deleteTask,
  updateCategory,
  updateSubcategory,
  updateTask,
  type Category,
  type SubCategory,
  type TaskRow,
} from "../actions";

const DESIGNATION_META = [
  { name: "Chairman",   chip: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",        dot: "bg-amber-500" },
  { name: "Management", chip: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",            dot: "bg-blue-500" },
  { name: "Supervisor", chip: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",    dot: "bg-purple-500" },
  { name: "General",    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
] as const;
const DESIGNATIONS = DESIGNATION_META.map((d) => d.name);

const BRANCH_CHIP = { chip: "bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400", dot: "bg-teal-500" } as const;

function designationChip(name: string) {
  return DESIGNATION_META.find((d) => d.name === name);
}

type Restr = { designations: string[] | null; branches: string[] | null };
// Would a user with the given designation/branch see this restricted item?
// Empty filter dimension = "any".
function allows(r: Restr, desig: string, branch: string): boolean {
  const dOk = !desig || !r.designations?.length || r.designations.includes(desig);
  const bOk = !branch || !r.branches?.length || r.branches.includes(branch);
  return dOk && bOk;
}

// ─── Modal target types ───────────────────────────────────────────────────────

type CatModal = { mode: "add"; taskId: number } | { mode: "edit"; taskId: number; category: Category };
type SubModal = { mode: "add"; categoryId: number } | { mode: "edit"; categoryId: number; sub: SubCategory };
type PendingDelete = { kind: "task" | "category" | "subcategory"; id: number; name: string };

// ─── Main Client ──────────────────────────────────────────────────────────────

export function TaskMasterClient({ initialTasks, branchNames }: { initialTasks: TaskRow[]; branchNames: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTasks[0]?.id ?? null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const [catModal, setCatModal] = useState<CatModal | null>(null);
  const [subModal, setSubModal] = useState<SubModal | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const selectedTask = initialTasks.find((t) => t.id === selectedTaskId) ?? null;

  const run = async (op: () => Promise<{ success: boolean; message?: string }>, ok: string) => {
    const res = await op();
    if (res.success) { toast.success(ok); refresh(); }
    else toast.error(res.message ?? "Something went wrong");
  };

  const handleSaveRename = () => {
    if (!editingTaskId || !editingName.trim()) { setEditingTaskId(null); return; }
    const id = editingTaskId, name = editingName.trim();
    setEditingTaskId(null);
    run(() => updateTask(id, name), "Task renamed.");
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    setPendingDelete(null);
    const fn =
      p.kind === "task" ? () => deleteTask(p.id)
        : p.kind === "category" ? () => deleteCategory(p.id)
          : () => deleteSubcategory(p.id);
    if (p.kind === "task" && selectedTaskId === p.id) {
      setSelectedTaskId(initialTasks.find((t) => t.id !== p.id)?.id ?? null);
    }
    run(fn, `${p.kind[0].toUpperCase()}${p.kind.slice(1)} deleted.`);
  };

  return (
    <>
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">Task Master</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Define tasks, their categories and subcategories, and who each applies to.
          </p>
        </div>
      </div>

      <div className={cn("mt-6 grid grid-cols-1 gap-5 items-start", selectedTask && "lg:grid-cols-[1fr_440px]")}>
        {/* Left: task list */}
        <Card className="gap-0">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
              <IconChip size="sm"><ClipboardList className="h-3.5 w-3.5 text-foreground" /></IconChip>
              All Tasks
              <Badge variant="outline">{initialTasks.length}</Badge>
            </CardTitle>
            <CardDescription>Click a task to manage its categories.</CardDescription>
            <CardAction>
              <Button
                onClick={() => setShowAddTask(true)}
                className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 active:scale-[0.98] gap-2 h-auto py-2.5 px-5"
              >
                <Plus className="h-4 w-4" />
                Add task
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="px-0 pt-0 pb-0">
            {initialTasks.length === 0 ? (
              <Empty className="border-0 rounded-none py-10">
                <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle className="text-base">No tasks yet</EmptyTitle>
                  <EmptyDescription>Add your first task above.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul>
                {initialTasks.map((task, idx) => (
                  <li
                    key={task.id}
                    onClick={() => { if (editingTaskId !== task.id) setSelectedTaskId(task.id); }}
                    className={cn(
                      "group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-colors cursor-pointer",
                      selectedTaskId === task.id && "bg-brand/5",
                    )}
                  >
                    <div className={cn(
                      "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold border",
                      selectedTaskId === task.id ? "bg-brand border-brand/40 text-foreground" : "bg-muted border-border text-muted-foreground",
                    )}>
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveRename(); if (e.key === "Escape") setEditingTaskId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-background border border-brand/40 rounded-lg px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-foreground truncate">{task.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.categories.length} {task.categories.length === 1 ? "category" : "categories"}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {editingTaskId === task.id ? (
                        <>
                          <Button variant="ghost" size="icon-xs" onClick={handleSaveRename} className="text-foreground hover:bg-brand/10">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => setEditingTaskId(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon-xs" onClick={() => { setEditingTaskId(task.id); setEditingName(task.name); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => setPendingDelete({ kind: "task", id: task.id, name: task.name })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          {selectedTaskId === task.id && <ChevronRight className="h-3.5 w-3.5 text-foreground" />}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right: categories + subcategories of selected task */}
        {selectedTask && (
          <CategoryPanel
            task={selectedTask}
            branchNames={branchNames}
            onAddCategory={() => setCatModal({ mode: "add", taskId: selectedTask.id })}
            onEditCategory={(category) => setCatModal({ mode: "edit", taskId: selectedTask.id, category })}
            onDeleteCategory={(id, name) => setPendingDelete({ kind: "category", id, name })}
            onAddSub={(categoryId) => setSubModal({ mode: "add", categoryId })}
            onEditSub={(categoryId, sub) => setSubModal({ mode: "edit", categoryId, sub })}
            onDeleteSub={(id, name) => setPendingDelete({ kind: "subcategory", id, name })}
          />
        )}
      </div>

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onAdded={() => { setShowAddTask(false); refresh(); }} />}

      {catModal && (
        <RestrictionModal
          title={catModal.mode === "add" ? "Add category" : "Edit category"}
          fieldLabel="Category name"
          branchNames={branchNames}
          initial={catModal.mode === "edit" ? catModal.category : undefined}
          onClose={() => setCatModal(null)}
          onSave={async (name, designations, branches) => {
            await run(
              () => catModal.mode === "add"
                ? createCategory(catModal.taskId, name, designations, branches)
                : updateCategory(catModal.category.id, name, designations, branches),
              catModal.mode === "add" ? "Category added." : "Category updated.",
            );
            setCatModal(null);
          }}
        />
      )}

      {subModal && (
        <RestrictionModal
          title={subModal.mode === "add" ? "Add subcategory" : "Edit subcategory"}
          fieldLabel="Subcategory name"
          branchNames={branchNames}
          initial={subModal.mode === "edit" ? { name: subModal.sub.label, designations: subModal.sub.designations, branches: subModal.sub.branches } : undefined}
          onClose={() => setSubModal(null)}
          onSave={async (name, designations, branches) => {
            await run(
              () => subModal.mode === "add"
                ? createSubcategory(subModal.categoryId, name, designations, branches)
                : updateSubcategory(subModal.sub.id, name, designations, branches),
              subModal.mode === "add" ? "Subcategory added." : "Subcategory updated.",
            );
            setSubModal(null);
          }}
        />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          title={`Delete ${pendingDelete.kind}?`}
          body={<><span className="font-medium text-foreground">&ldquo;{pendingDelete.name}&rdquo;</span>{pendingDelete.kind !== "subcategory" ? " and everything under it" : ""} will be permanently deleted.</>}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

// ─── Restriction chips ────────────────────────────────────────────────────────

function RestrictionChips({ r }: { r: Restr }) {
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {r.designations?.length ? r.designations.map((d) => {
        const c = designationChip(d);
        return c ? (
          <span key={d} className={cn("inline-flex items-center gap-1 px-1.5 rounded-full border text-[10px] font-medium", c.chip)}>
            <span className={cn("h-1 w-1 rounded-full", c.dot)} />{d}
          </span>
        ) : null;
      }) : <span className="inline-flex items-center px-1.5 rounded-full border border-border bg-muted text-[10px] text-muted-foreground">All designations</span>}
      {r.branches?.length ? r.branches.map((b) => (
        <span key={b} className={cn("inline-flex items-center gap-1 px-1.5 rounded-full border text-[10px] font-medium", BRANCH_CHIP.chip)}>
          <span className={cn("h-1 w-1 rounded-full", BRANCH_CHIP.dot)} />{b}
        </span>
      )) : <span className="inline-flex items-center px-1.5 rounded-full border border-border bg-muted text-[10px] text-muted-foreground">All branches</span>}
    </div>
  );
}

// ─── Category panel ───────────────────────────────────────────────────────────

function CategoryPanel({
  task, branchNames, onAddCategory, onEditCategory, onDeleteCategory, onAddSub, onEditSub, onDeleteSub,
}: {
  task: TaskRow;
  branchNames: string[];
  onAddCategory: () => void;
  onEditCategory: (c: Category) => void;
  onDeleteCategory: (id: number, name: string) => void;
  onAddSub: (categoryId: number) => void;
  onEditSub: (categoryId: number, s: SubCategory) => void;
  onDeleteSub: (id: number, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fDesig, setFDesig] = useState("");

  // Search matches category or subcategory name; the branch/designation filter
  // keeps categories/subcategories a user with that scope would see (both levels).
  // Search kicks in at 3+ characters; shorter input is treated as no search.
  const trimmed = query.trim();
  const q = trimmed.length >= 3 ? trimmed.toLowerCase() : "";
  const matches = (s: string) => !q || s.toLowerCase().includes(q);
  const visible = task.categories
    .filter((c) => allows(c, fDesig, fBranch))
    .map((c) => {
      const catNameMatch = matches(c.name);
      const subs = c.subcategories.filter((s) => allows(s, fDesig, fBranch) && (catNameMatch || matches(s.label)));
      return { c, subs, show: catNameMatch || subs.length > 0 };
    })
    .filter((x) => x.show);

  const catItems = visible.map(({ c, subs }) => (
    <AccordionItem key={c.id} value={String(c.id)} className="px-4">
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <AccordionTrigger className="py-3.5 hover:no-underline">
            <div className="min-w-0 text-left">
              <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
              <RestrictionChips r={c} />
            </div>
          </AccordionTrigger>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pt-4">
          <Button variant="ghost" size="icon-xs" onClick={() => onEditCategory(c)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onDeleteCategory(c.id, c.name)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>

      <AccordionContent className="pb-3">
        <ul className="ml-1 border-l border-border/60 pl-3 space-y-1.5">
          {subs.map((s) => (
            <li key={s.id} className="group/sub flex items-start gap-2 rounded-lg px-2 py-1.5 border border-transparent transition-colors hover:border-border hover:bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate mb-0!">{s.label}</p>
                <RestrictionChips r={s} />
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon-xs" onClick={() => onEditSub(c.id, s)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onDeleteSub(s.id, s.label)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </li>
          ))}
          <li>
            <Button variant="ghost" onClick={() => onAddSub(c.id)} className="text-xs text-foreground hover:bg-brand/10 gap-1 h-auto py-1 px-2 rounded-full">
              <Plus className="h-3 w-3" /> Add subcategory
            </Button>
          </li>
        </ul>
      </AccordionContent>
    </AccordionItem>
  ));

  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-foreground mb-0.5">Selected task</p>
          <CardTitle className="text-base font-bold truncate">{task.name}</CardTitle>
        </div>
        <CardAction>
          <Button onClick={onAddCategory} className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-1.5 h-auto py-1.5 px-3 text-xs">
            <Plus className="h-3 w-3" />
            Add category
          </Button>
        </CardAction>
      </CardHeader>

      {/* Search + filter over categories/subcategories */}
      {task.categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="pl-8 rounded-full bg-muted border-border text-sm h-8 focus-visible:ring-brand/30"
            />
          </div>
          <FilterSelect label="Branch" value={fBranch} onChange={setFBranch} options={branchNames} />
          <FilterSelect label="Designation" value={fDesig} onChange={setFDesig} options={DESIGNATIONS} />
        </div>
      )}

      <CardContent className="px-0 pt-0 pb-0">
        {task.categories.length === 0 ? (
          <Empty className="border-0 rounded-none py-10">
            <EmptyMedia variant="icon"><FolderTree /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">No categories yet</EmptyTitle>
              <EmptyDescription>Add a category, then subcategories under it.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : visible.length === 0 ? (
          <Empty className="border-0 rounded-none py-10">
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">No matches</EmptyTitle>
              <EmptyDescription>Try a different search or filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : q ? (
          // Search active: expand every matching category so subcategory hits are
          // visible. Re-keyed on the query so it re-opens as the search changes.
          <Accordion type="multiple" key={q} defaultValue={visible.map(({ c }) => String(c.id))} className="border-0 rounded-none">
            {catItems}
          </Accordion>
        ) : (
          // Browsing: one open at a time, all closed by default.
          <Accordion type="single" collapsible className="border-0 rounded-none">
            {catItems}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Filter select ────────────────────────────────────────────────────────────
// Radix Select forbids empty-string values, so "all" uses a sentinel.
const ALL = "__all__";

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger size="sm" className={cn("rounded-full text-xs bg-muted", value && "border-brand/40")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Restriction modal (category & subcategory) ───────────────────────────────

function RestrictionModal({
  title, fieldLabel, branchNames, initial, onClose, onSave,
}: {
  title: string;
  fieldLabel: string;
  branchNames: string[];
  initial?: { name: string; designations: string[] | null; branches: string[] | null };
  onClose: () => void;
  onSave: (name: string, designations: string[] | null, branches: string[] | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [designations, setDesignations] = useState<string[]>(initial?.designations ?? []);
  const [branches, setBranches] = useState<string[]>(initial?.branches ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      try { await onSave(name.trim(), designations.length ? designations : null, branches.length ? branches : null); }
      catch { setError("Something went wrong"); }
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></Button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">{fieldLabel}</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Passbook" className="rounded-xl bg-muted border-border focus-visible:ring-brand/30" />
          </label>

          <div>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-2">Designations</span>
            <div className="flex flex-wrap gap-1.5">
              {DESIGNATION_META.map(({ name: dn, chip, dot }) => {
                const active = designations.includes(dn);
                return (
                  <Button key={dn} type="button" variant="ghost" onClick={() => toggle(designations, setDesignations, dn)}
                    className={cn("rounded-full border px-3 py-1.5 h-auto text-xs font-medium gap-1.5", active ? chip : "bg-muted border-border text-muted-foreground hover:bg-muted hover:border-foreground/20")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? dot : "bg-muted-foreground/40")} />{dn}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{designations.length === 0 ? "No selection — all designations." : `Applies to: ${designations.join(", ")}.`}</p>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-2">Branches</span>
            <div className="flex flex-wrap gap-1.5">
              {branchNames.map((bn) => {
                const active = branches.includes(bn);
                return (
                  <Button key={bn} type="button" variant="ghost" onClick={() => toggle(branches, setBranches, bn)}
                    className={cn("rounded-full border px-3 py-1.5 h-auto text-xs font-medium gap-1.5", active ? BRANCH_CHIP.chip : "bg-muted border-border text-muted-foreground hover:bg-muted hover:border-foreground/20")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? BRANCH_CHIP.dot : "bg-muted-foreground/40")} />{bn}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {branchNames.length === 0 ? "No active branches." : branches.length === 0 ? "No selection — all branches." : `Applies to: ${branches.join(", ")}.`}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button type="submit" disabled={!name.trim() || isPending} className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5">
            <Check className="h-3.5 w-3.5" />
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const res = await createTask(name.trim());
      if (res.success) { toast.success("Task added."); onAdded(); }
      else setError(res.message);
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <h3 className="text-xl font-bold tracking-tight text-foreground">Add a task</h3>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-6 py-5">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Task name</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mobilisation" className="rounded-xl bg-muted border-border focus-visible:ring-brand/30" />
          </label>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button type="submit" disabled={!name.trim() || isPending} className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5">
            <Plus className="h-3.5 w-3.5" />
            {isPending ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ title, body, onConfirm, onCancel }: { title: string; body: React.ReactNode; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="px-6 pt-6 pb-4">
        <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 grid place-items-center mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-bold text-foreground capitalize">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5">{body}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} className="rounded-full">Cancel</Button>
        <Button onClick={onConfirm} className="rounded-full gap-2 bg-destructive text-background hover:bg-destructive/90">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </ModalShell>
  );
}
