const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function requireProjectId(projectId: string): string {
  const id = projectId.trim();
  if (!id) throw new Error("请填写 Project ID（项目的 UUID）。");
  if (!isValidUuid(id)) throw new Error("Project ID 不是有效的 UUID。");
  return id;
}
