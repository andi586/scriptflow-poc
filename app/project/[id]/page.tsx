import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id || id === "undefined") {
    redirect("/en/dashboard");
  }

  try {
    return redirect(`/en/project/${id.trim()}`);
  } catch {
    redirect("/en/dashboard");
  }
}

