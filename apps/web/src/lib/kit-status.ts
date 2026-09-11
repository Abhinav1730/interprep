export function kitStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Ready";
    case "generating":
      return "Building…";
    case "queued":
      return "Queued…";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function kitStatusClass(status: string): string {
  if (status === "completed") return "bg-accent-light text-accent-dark";
  if (status === "generating" || status === "queued") return "bg-amber-50 text-warn";
  if (status === "failed") return "bg-red-50 text-danger";
  return "bg-canvas text-mute";
}
