import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connection: async () => {},
}));
const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/classroom/auth", () => ({
  authConfig: () => null,
  requireTeacher: async () => {
    if (!auth.allowed) throw new Error("SIGN_IN");
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import TeacherPage from "@/app/classroom/page";
import TeacherExercisePage from "@/app/classroom/exercises/[slug]/page";
import StudentPage from "@/app/exercises/[slug]/page";
import LoginPage from "@/app/classroom/login/page";
import Loading from "@/app/classroom/loading";
import ClassroomError from "@/app/classroom/error";
import ExerciseError from "@/app/exercises/error";
import ClassroomLayout from "@/app/classroom/layout";
import SharedLayout from "@/app/exercises/layout";

afterEach(() => {
  cleanup();
  auth.allowed = true;
});
describe("Classroom routes", () => {
  it("renders the library and teacher workspace only after authorization", async () => {
    auth.allowed = false;
    await expect(TeacherPage()).rejects.toThrow("SIGN_IN");
    await expect(
      TeacherExercisePage({
        params: Promise.resolve({ slug: "csharp-await-task" }),
      }),
    ).rejects.toThrow("SIGN_IN");
    auth.allowed = true;
    render(await TeacherPage());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your next great lesson",
    );
    cleanup();
    render(
      await TeacherExercisePage({
        params: Promise.resolve({ slug: "csharp-await-task" }),
      }),
    );
    expect(
      screen.getByText("Private draft · sharing unavailable"),
    ).toBeInTheDocument();
  });
  it("renders public student exercises and rejects private or missing exercises", async () => {
    render(
      await StudentPage({
        params: Promise.resolve({ slug: "python-loop-accumulator" }),
      }),
    );
    expect(
      screen.queryByText("Answer guide & teaching notes"),
    ).not.toBeInTheDocument();
    for (const slug of ["csharp-await-task", "unknown"])
      await expect(
        StudentPage({ params: Promise.resolve({ slug }) }),
      ).rejects.toThrow("NOT_FOUND");
    await expect(
      TeacherExercisePage({ params: Promise.resolve({ slug: "unknown" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("shows truthful unconfigured login, loading and recoverable errors", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "hasn’t been configured",
    );
    expect(
      screen.queryByRole("button", { name: "Open Classroom" }),
    ).not.toBeInTheDocument();
    cleanup();
    render(<Loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    cleanup();
    const reset = vi.fn();
    render(<ClassroomError reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    cleanup();
    render(<ExerciseError reset={reset} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    cleanup();
    render(
      <ClassroomLayout>
        <p>Classroom child</p>
      </ClassroomLayout>,
    );
    expect(screen.getByText("Classroom child")).toBeInTheDocument();
    cleanup();
    render(
      <SharedLayout>
        <p>Shared child</p>
      </SharedLayout>,
    );
    expect(screen.getByText("Shared child")).toBeInTheDocument();
  });
});
