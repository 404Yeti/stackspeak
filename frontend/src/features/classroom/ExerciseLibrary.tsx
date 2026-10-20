"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PipMascot } from "@/components/ui/PipMascot";
import { ClassroomHeader } from "./ClassroomHeader";
import { filterExercises } from "./filter";
import type { ExerciseSummary } from "./types";

type LibraryItem = ExerciseSummary & { publication: string; sharing: string };
export function ExerciseLibrary({ exercises }: { exercises: LibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const matches = filterExercises(
    exercises,
    query,
    language,
    topic,
    difficulty,
  ) as LibraryItem[];
  function clear() {
    setQuery("");
    setLanguage("");
    setTopic("");
    setDifficulty("");
  }
  return (
    <div className="classroom-shell">
      <ClassroomHeader teacher />
      <div className="classroom-library">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="classroom-eyebrow">PREPARE LESS. CONNECT MORE.</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Your next great lesson starts here.
            </h1>
            <p className="mt-4 max-w-2xl text-text-muted">
              Code worth discussing. Language worth practicing. Choose an
              exercise and make it a conversation.
            </p>
          </div>
          <div className="hidden md:block">
            <PipMascot expression="idea" size={112} alt="" />
          </div>
        </div>
        <section aria-label="Find exercises" className="classroom-filters">
          <label className="classroom-search">
            Search exercises
            <input
              className="classroom-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try “Python loops”"
            />
          </label>
          {[
            {
              label: "Language",
              value: language,
              set: setLanguage,
              choices: [...new Set(exercises.map((e) => e.language))],
            },
            {
              label: "Topic",
              value: topic,
              set: setTopic,
              choices: [...new Set(exercises.flatMap((e) => e.topics))].sort(),
            },
            {
              label: "Difficulty",
              value: difficulty,
              set: setDifficulty,
              choices: [...new Set(exercises.map((e) => e.difficulty))],
            },
          ].map((f) => (
            <label key={f.label} htmlFor={`filter-${f.label}`}>
              {f.label}
              <select
                id={`filter-${f.label}`}
                className="classroom-input"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              >
                <option value="">
                  All{" "}
                  {f.label === "Difficulty"
                    ? "levels"
                    : f.label === "Language"
                      ? "languages"
                      : "topics"}
                </option>
                {f.choices.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ))}
        </section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-text-muted">
            {matches.length} {matches.length === 1 ? "exercise" : "exercises"} ·
            Teacher guides require private configuration
          </p>
          {(query || language || topic || difficulty) && (
            <button className="classroom-text-button" onClick={clear}>
              Clear filters
            </button>
          )}
        </div>
        <div className="space-y-4">
          {matches.map((e) => (
            <article className="classroom-exercise-card" key={e.id}>
              <div className="classroom-language" aria-hidden="true">
                {e.language === "Python" ? "Py" : e.language}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="info">{e.language}</Badge>
                  <Badge>{e.difficulty}</Badge>
                  <span className="text-xs text-text-muted">
                    {e.minutes} min
                  </span>
                  {e.publication === "draft" && (
                    <Badge tone="accent">Private draft</Badge>
                  )}
                </div>
                <h2 className="text-lg font-semibold">{e.title}</h2>
                <p className="mt-2 text-sm text-text-muted">{e.description}</p>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Topics">
                  {e.topics.map((topic) => (
                    <span key={topic} className="classroom-topic">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                href={`/classroom/exercises/${e.slug}`}
                aria-label={`Open ${e.title}`}
              >
                Open exercise <span aria-hidden="true">→</span>
              </Button>
            </article>
          ))}
        </div>
        {!matches.length && (
          <section className="rounded-lg border border-border-subtle bg-surface p-10 text-center">
            <PipMascot expression="thinking" size={72} alt="" />
            <h2 className="mt-4 text-xl font-semibold">
              No exercises match yet
            </h2>
            <p className="my-4 text-text-muted">
              Try fewer words or clear a filter to explore the library.
            </p>
            <Button onClick={clear}>Clear filters</Button>
          </section>
        )}
        <p className="mt-8 text-xs text-text-muted">
          Teacher-led by design. No automatic grading, recording, or live
          synchronized editing.
        </p>
      </div>
    </div>
  );
}
