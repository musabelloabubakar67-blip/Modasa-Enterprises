export const STATUS_STYLES = {
  requested: "bg-accent/10 text-accent",
  dispatched: "bg-amber-100 text-amber-800",
  received: "bg-success/10 text-success",
  cancelled: "bg-background text-muted",
} as const;

export const STATUS_LABELS = {
  requested: "Requested",
  dispatched: "In transit",
  received: "Received",
  cancelled: "Cancelled",
} as const;
