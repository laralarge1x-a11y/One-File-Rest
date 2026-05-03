export const colors = {
  bg: "#36393f",
  bgDeep: "#202225",
  bgPanel: "#2f3136",
  bgInput: "#40444b",
  accent: "#5865f2",
  accentHover: "#4752c4",
  ok: "#57f287",
  warn: "#fee75c",
  danger: "#ed4245",
  muted: "#b9bbbe",
  text: "#dcddde",
  textBright: "#ffffff",
  border: "#202225",
} as const;

export const priorityColor = (p?: string) =>
  p === "critical" ? colors.danger : p === "high" ? colors.warn : colors.muted;

export const statusLabel = (s: string) =>
  s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
