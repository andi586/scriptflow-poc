import { redirect } from "next/navigation";

export default function ProjectWrapperPage({
  params,
}: {
  params: { id: string };
}) {
  return redirect(`/en/project/${params.id}`);
}

