export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#3b82f6";
    case "info": return "#8b95a8";
    case "fixed": return "#22c55e";
    default: return "#8b95a8";
  }
}

export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case "critical": return "Critical";
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
    case "info": return "Info";
    case "fixed": return "Fixed";
    default: return severity;
  }
}
