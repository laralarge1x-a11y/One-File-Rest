import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface QueueCase {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  priority: string;
  appeal_deadline?: string | null;
  staff_assigned_id?: string | null;
  snoozed_until?: string | null;
  hours_to_deadline?: number | null;
  hours_since_update?: number | null;
  unread_client?: number;
  discord_username?: string;
  discord_avatar?: string | null;
  staff_name?: string | null;
  plan?: string | null;
}

export interface QueueResponse {
  hot: QueueCase[];
  stalled: QueueCase[];
  in_flight: QueueCase[];
  my_queue: QueueCase[];
  snoozed: QueueCase[];
  counts: Record<string, number>;
}

export const useQueue = () =>
  useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => api<QueueResponse>("/api/admin/queue"),
    refetchInterval: 30000,
  });

export const useCase = (id: number | string | undefined) =>
  useQuery({
    queryKey: ["case", id],
    queryFn: () => api<any>(`/api/cases/${id}`),
    enabled: !!id,
  });

export const useMessages = (caseId: number | string | undefined) =>
  useQuery({
    queryKey: ["case", caseId, "messages"],
    queryFn: () => api<any[]>(`/api/messages/${caseId}`),
    enabled: !!caseId,
  });

export const useEvidence = (caseId: number | string | undefined) =>
  useQuery({
    queryKey: ["case", caseId, "evidence"],
    queryFn: () => api<any[]>(`/api/evidence/${caseId}`),
    enabled: !!caseId,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: any[]; unread: number }>("/api/notifications"),
    refetchInterval: 60000,
  });

export const useKbArticles = (q?: string) =>
  useQuery({
    queryKey: ["kb", q || ""],
    queryFn: () => api<any[]>(`/api/kb${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

export const useSpecialists = () =>
  useQuery({
    queryKey: ["staff-public"],
    queryFn: () => api<any[]>("/api/staff-public"),
  });

export const useTemplates = () =>
  useQuery({
    queryKey: ["templates"],
    queryFn: () => api<any[]>("/api/templates"),
  });
