"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/src/components/ui/empty";
import { HeaderGlow, IconChip } from "@/src/components/page-ui";
import {
  createAnswerOption,
  createTask,
  deleteAnswerOption,
  deleteTask,
  updateAnswerOption,
  updateTask,
  type TaskRow,
  type AnswerOption,
} from "../actions";

const DESIGNATION_META = [
  { name: "Chairman",   chip: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",        dot: "bg-amber-500" },
  { name: "Management", chip: "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400",            dot: "bg-blue-500" },
  { name: "Supervisor", chip: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",    dot: "bg-purple-500" },
  { name: "General",    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
] as const;

function getDesignationColors(name: string) {
  return DESIGNATION_META.find((d) => d.name === name);
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function TaskMasterClient({ initialTasks }: { initialTasks: TaskRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTasks[0]?.id ?? null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAnswer, setShowAddAnswer] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [removingTaskId, setRemovingTaskId] = useState<number | null>(null);
  const [removingAnswerId, setRemovingAnswerId] = useState<number | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<{ id: number; name: string } | null>(null);
  const [pendingDeleteAnswer, setPendingDeleteAnswer] = useState<{ id: number; label: string } | null>(null);
  const [pendingEditAnswer, setPendingEditAnswer] = useState<AnswerOption | null>(null);

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleAddTask = (name: string) => {
    setShowAddTask(false);
    toast.success("Task added.");
    router.refresh();
  };

  const handleStartEdit = (task: TaskRow) => {
    setEditingTaskId(task.id);
    setEditingName(task.name);
  };

  const handleSaveEdit = () => {
    if (!editingTaskId || !editingName.trim()) { setEditingTaskId(null); return; }
    const id = editingTaskId;
    const name = editingName.trim();
    setEditingTaskId(null);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    startTransition(async () => {
      const result = await updateTask(id, name);
      if (!result.success) {
        toast.error(result.message ?? "Failed to rename task");
        router.refresh();
      } else {
        toast.success("Task renamed.");
      }
    });
  };

  const confirmDeleteTask = () => {
    if (!pendingDeleteTask) return;
    const { id } = pendingDeleteTask;
    setPendingDeleteTask(null);
    setRemovingTaskId(id);
    if (selectedTaskId === id) setSelectedTaskId(tasks.find((t) => t.id !== id)?.id ?? null);
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setRemovingTaskId(null);
      startTransition(async () => {
        const result = await deleteTask(id);
        if (!result.success) {
          toast.error(result.message ?? "Failed to delete task");
          router.refresh();
        } else {
          toast.success("Task deleted.");
        }
      });
    }, 220);
  };

  const handleAddAnswer = async (label: string, designations: string[] | null) => {
    if (!selectedTaskId) return;
    setShowAddAnswer(false);
    const tempId = -Date.now();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTaskId
          ? { ...t, answers: [...t.answers, { id: tempId, label, sortOrder: t.answers.length, designations }] }
          : t,
      ),
    );
    const result = await createAnswerOption(selectedTaskId, label, designations);
    if (!result.success) {
      toast.error(result.message ?? "Failed to add answer option");
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, answers: t.answers.filter((a) => a.id !== tempId) } : t,
        ),
      );
    } else {
      toast.success("Answer option added.");
      router.refresh(); // replaces temp ID with real DB ID
    }
  };

  const handleEditAnswer = async (id: number, label: string, designations: string[] | null) => {
    setPendingEditAnswer(null);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === selectedTaskId
          ? { ...t, answers: t.answers.map((a) => (a.id === id ? { ...a, label, designations } : a)) }
          : t,
      ),
    );
    const result = await updateAnswerOption(id, label, designations);
    if (!result.success) {
      toast.error(result.message ?? "Failed to update answer option");
      router.refresh();
    } else {
      toast.success("Answer option updated.");
    }
  };

  const confirmDeleteAnswer = () => {
    if (!pendingDeleteAnswer) return;
    const { id } = pendingDeleteAnswer;
    setPendingDeleteAnswer(null);
    setRemovingAnswerId(id);
    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, answers: t.answers.filter((a) => a.id !== id) } : t,
        ),
      );
      setRemovingAnswerId(null);
      startTransition(async () => {
        const result = await deleteAnswerOption(id);
        if (!result.success) {
          toast.error(result.message ?? "Failed to remove answer option");
          router.refresh();
        } else {
          toast.success("Answer option removed.");
        }
      });
    }, 220);
  };

  return (
    <>
      <div className="relative isolate flex flex-wrap items-end justify-between gap-4">
        <HeaderGlow />
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Task Master
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Define tasks and configure predefined answer options for all designations.
          </p>
        </div>
      </div>

      <div className={cn("mt-6 grid grid-cols-1 gap-5 items-start", selectedTask && "lg:grid-cols-[1fr_400px]")}>
        <Card className="gap-0">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2.5 text-xl font-bold">
              <IconChip size="sm"><ClipboardList className="h-3.5 w-3.5 text-foreground" /></IconChip>
              All Tasks
              <Badge variant="outline">{tasks.length}</Badge>
            </CardTitle>
            <CardDescription>Click a task to manage its answer options.</CardDescription>
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
            <ul>
              {tasks.map((task, idx) => (
                <li
                  key={task.id}
                  onClick={() => { if (editingTaskId !== task.id) setSelectedTaskId(task.id); }}
                  className={cn(
                    "group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-all duration-200 cursor-pointer",
                    selectedTaskId === task.id && "bg-brand/5",
                    removingTaskId === task.id && "opacity-0 -translate-x-3",
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors",
                    selectedTaskId === task.id
                      ? "bg-brand border-brand/40 text-foreground"
                      : "bg-muted border-border text-muted-foreground",
                  )}>
                    {idx + 1}
                  </div>

                  <div className="min-w-0">
                    {editingTaskId === task.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingTaskId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-background border border-brand/40 rounded-lg px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-foreground truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.answers.length} {task.answers.length === 1 ? "answer option" : "answer options"}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {editingTaskId === task.id ? (
                      <>
                        <Button variant="ghost" size="icon-xs" onClick={handleSaveEdit} className="text-foreground hover:text-foreground hover:bg-brand/10">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setEditingTaskId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon-xs" onClick={() => handleStartEdit(task)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setPendingDeleteTask({ id: task.id, name: task.name })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {selectedTaskId === task.id && <ChevronRight className="h-3.5 w-3.5 text-foreground" />}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {selectedTask && (
          <AnswerPanel
            task={selectedTask}
            removingAnswerId={removingAnswerId}
            onRequestAddAnswer={() => setShowAddAnswer(true)}
            onRequestEditAnswer={(ans) => setPendingEditAnswer(ans)}
            onRequestDeleteAnswer={(id, label) => setPendingDeleteAnswer({ id, label })}
          />
        )}
      </div>

      {showAddTask && (
        <AddTaskModal onClose={() => setShowAddTask(false)} onAdd={handleAddTask} />
      )}

      {showAddAnswer && selectedTask && (
        <AnswerOptionModal
          mode="add"
          taskName={selectedTask.name}
          onClose={() => setShowAddAnswer(false)}
          onSave={handleAddAnswer}
        />
      )}

      {pendingEditAnswer && (
        <AnswerOptionModal
          mode="edit"
          taskName={selectedTask?.name ?? ""}
          initial={pendingEditAnswer}
          onClose={() => setPendingEditAnswer(null)}
          onSave={(label, designations) => handleEditAnswer(pendingEditAnswer.id, label, designations)}
        />
      )}

      {pendingDeleteTask && (
        <DeleteConfirmModal
          title="Delete task?"
          body={<>Task <span className="font-medium text-foreground">"{pendingDeleteTask.name}"</span> and all its answer options will be permanently deleted.</>}
          onConfirm={confirmDeleteTask}
          onCancel={() => setPendingDeleteTask(null)}
        />
      )}

      {pendingDeleteAnswer && (
        <DeleteConfirmModal
          title="Remove answer option?"
          body={<><span className="font-medium text-foreground">"{pendingDeleteAnswer.label}"</span> will be permanently removed from this task.</>}
          onConfirm={confirmDeleteAnswer}
          onCancel={() => setPendingDeleteAnswer(null)}
        />
      )}
    </>
  );
}

// ─── Answer Panel ─────────────────────────────────────────────────────────────

function AnswerPanel({
  task,
  removingAnswerId,
  onRequestAddAnswer,
  onRequestEditAnswer,
  onRequestDeleteAnswer,
}: {
  task: TaskRow;
  removingAnswerId: number | null;
  onRequestAddAnswer: () => void;
  onRequestEditAnswer: (ans: AnswerOption) => void;
  onRequestDeleteAnswer: (id: number, label: string) => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b border-border min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-foreground mb-0.5">Selected task</p>
          <CardTitle className="text-base font-bold truncate">{task.name}</CardTitle>
        </div>
        <CardAction>
          <Button
            onClick={onRequestAddAnswer}
            className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-1.5 h-auto py-1.5 px-3 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add option
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 pt-0 pb-0">
        {task.answers.length === 0 ? (
          <Empty className="border-0 rounded-none py-10">
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">No answer options yet</EmptyTitle>
              <EmptyDescription>Add the first predefined answer option for this task.</EmptyDescription>
            </EmptyHeader>
            <Button
              variant="ghost"
              onClick={onRequestAddAnswer}
              className="text-xs text-foreground hover:text-foreground hover:bg-brand/10 gap-1 h-auto py-1.5 px-3 rounded-full"
            >
              <Plus className="h-3 w-3" />
              Add the first one
            </Button>
          </Empty>
        ) : (
          <ul>
            {task.answers.map((ans, idx) => (
              <li
                key={ans.id}
                className={cn(
                  "group flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-all duration-200",
                  removingAnswerId === ans.id && "opacity-0 -translate-x-3",
                )}
              >
                <span className="h-5 w-5 shrink-0 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ans.label}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ans.designations?.length ? (
                      ans.designations.map((d) => {
                        const colors = getDesignationColors(d);
                        return colors ? (
                          <span key={d} className={cn("inline-flex items-center gap-1 px-1.5 rounded-full border text-[10px] font-medium", colors.chip)}>
                            <span className={cn("h-1 w-1 rounded-full shrink-0", colors.dot)} />
                            {d}
                          </span>
                        ) : null;
                      })
                    ) : (
                      <span className="inline-flex items-center px-1.5 rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground">
                        All
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon-xs" onClick={() => onRequestEditAnswer(ans)} className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => onRequestDeleteAnswer(ans.id, ans.label)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Answer Option Modal (Add & Edit) ─────────────────────────────────────────

function AnswerOptionModal({
  mode,
  taskName,
  initial,
  onClose,
  onSave,
}: {
  mode: "add" | "edit";
  taskName: string;
  initial?: AnswerOption;
  onClose: () => void;
  onSave: (label: string, designations: string[] | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [designations, setDesignations] = useState<string[]>(initial?.designations ?? []);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        await onSave(label.trim(), designations.length > 0 ? designations : null);
      } catch {
        setError("Something went wrong");
      }
    });
  };

  const toggleDesignation = (d: string) =>
    setDesignations((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold text-foreground tracking-widest uppercase">{taskName}</p>
            <h3 className="text-xl font-bold tracking-tight mt-1 text-foreground">
              {mode === "add" ? "Add answer option" : "Edit answer option"}
            </h3>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Label</span>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Completed"
              className="rounded-xl bg-muted border-border focus-visible:ring-brand/30 focus-visible:border-brand/40"
            />
          </label>

          <div>
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-2">Applies to</span>
            <div className="flex flex-wrap gap-1.5">
              {DESIGNATION_META.map(({ name, chip, dot }) => {
                const active = designations.includes(name);
                return (
                  <Button
                    key={name}
                    type="button"
                    variant="ghost"
                    onClick={() => toggleDesignation(name)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 h-auto text-xs font-medium gap-1.5",
                      active ? chip : "bg-muted border-border text-muted-foreground hover:bg-muted hover:border-foreground/20",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active ? dot : "bg-muted-foreground/40")} />
                    {name}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {designations.length === 0
                ? "No selection — applies to all designations."
                : `Applies to: ${designations.join(", ")}.`}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button
            type="submit"
            disabled={!label.trim() || isPending}
            className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5"
          >
            {mode === "add" ? <Plus className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {isPending ? (mode === "add" ? "Adding…" : "Saving…") : (mode === "add" ? "Add option" : "Save changes")}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await createTask(name.trim());
      if (result.success) { onAdd(name.trim()); } else { setError(result.message); }
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <p className="text-[10px] font-semibold text-foreground tracking-widest uppercase">New task</p>
            <h3 className="text-xl font-bold tracking-tight mt-1 text-foreground">Add a task</h3>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-5">
          <label className="block">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase block mb-1.5">Task name</span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Status"
              className="rounded-xl bg-muted border-border focus-visible:ring-brand/30 focus-visible:border-brand/40"
            />
          </label>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button
            type="submit"
            disabled={!name.trim() || isPending}
            className="rounded-full bg-brand text-foreground hover:bg-brand hover:brightness-105 gap-2 h-auto py-2 px-5"
          >
            <Plus className="h-3.5 w-3.5" />
            {isPending ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  title,
  body,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="px-6 pt-6 pb-4">
        <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 grid place-items-center mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
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
