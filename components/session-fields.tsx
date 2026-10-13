"use client";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Input } from "./ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
export type SessionDraft = {
  date: string;
  participantIds: string[];
  completed: boolean;
  progressPercent: number;
  progressSeconds: number;
};
export function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function SessionFields({
  value,
  onChange,
}: {
  value: SessionDraft;
  onChange: (value: SessionDraft) => void;
}) {
  const { people } = useWorkspace();
  return (
    <div className="space-y-5 rounded-[var(--radius-md)] bg-[var(--surface-soft)] p-4 sm:p-5">
      <label className="block text-sm font-bold">
        When was it?
        <Input
          type="datetime-local"
          required
          className="mt-2"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Who was there?</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={value.participantIds.includes(p.id)}
              onClick={() =>
                onChange({
                  ...value,
                  participantIds: value.participantIds.includes(p.id)
                    ? value.participantIds.filter((id) => id !== p.id)
                    : [...value.participantIds, p.id],
                })
              }
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                value.participantIds.includes(p.id)
                  ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent-deep)]"
                  : "border-[var(--line)] bg-white",
              )}
            >
              <span aria-hidden="true">
                <Avatar
                  name={p.name}
                  src={p.avatar}
                  color={p.color}
                  size="sm"
                />
              </span>
              {p.name}
              {value.participantIds.includes(p.id) && (
                <Check size={14} aria-hidden />
              )}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.completed}
          onChange={(e) =>
            onChange({
              ...value,
              completed: e.target.checked,
              progressPercent: e.target.checked ? 100 : value.progressPercent,
            })
          }
        />
        Finished
      </label>
      {!value.completed && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">
            Progress %
            <Input
              type="number"
              min={0}
              max={100}
              value={value.progressPercent}
              onChange={(e) =>
                onChange({ ...value, progressPercent: Number(e.target.value) })
              }
            />
          </label>
          <label className="text-sm font-bold">
            Progress seconds
            <Input
              type="number"
              min={0}
              value={value.progressSeconds}
              onChange={(e) =>
                onChange({ ...value, progressSeconds: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
