import { ProjectDetail } from "@/components/app/project-detail";
import { Id } from "@/convex/_generated/dataModel";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectDetail projectId={projectId as Id<"projects">} />;
}
