export const applicationStatuses = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export const statusLabels: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export const statusDescriptions: Record<ApplicationStatus, string> = {
  SAVED: "Roles you are still considering.",
  APPLIED: "Applications sent and waiting.",
  INTERVIEW: "Conversations in progress.",
  OFFER: "Offers on the table.",
  REJECTED: "Closed applications, kept for learning.",
};

export const statusAccent: Record<ApplicationStatus, string> = {
  SAVED: "border-t-slate-400",
  APPLIED: "border-t-sky-500",
  INTERVIEW: "border-t-amber-500",
  OFFER: "border-t-emerald-500",
  REJECTED: "border-t-rose-400",
};

export const gapStatusLabels: Record<string, string> = {
  OPEN: "Open",
  PLANNED: "Planned",
  DONE: "Done",
  DISMISSED: "Dismissed",
};
