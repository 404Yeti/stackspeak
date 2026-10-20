import { Suspense } from "react";
import Loading from "./loading";
export const metadata = {
  title: "Classroom — StackSpeak",
  robots: { index: false, follow: false },
};
export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
