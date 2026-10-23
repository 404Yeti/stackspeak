import { requireTeacher } from "@/lib/classroom/auth";
import { StudioLibrary } from "@/features/classroom/studio/StudioLibrary";
export default async function StudioPage() {
  await requireTeacher();
  return <StudioLibrary />;
}
