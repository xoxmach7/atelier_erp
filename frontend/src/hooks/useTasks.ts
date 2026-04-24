/**
 * Tasks TanStack Query Hooks
 */

import { useQuery } from "@tanstack/react-query";
import { fetchTasks, fetchTaskById } from "@/services/http/tasks";
import type { TaskDTO, TaskListResponse } from "@/services/http/tasks";

const TASKS_QUERY_KEY = "tasks";

/**
 * Hook for fetching tasks list (active quoting tasks by default)
 */
export function useTasks(status?: string) {
  return useQuery<TaskListResponse, Error>({
    queryKey: [TASKS_QUERY_KEY, { status }],
    queryFn: () => fetchTasks(status),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching single task by ID
 */
export function useTask(taskId: string | null) {
  return useQuery<TaskDTO, Error>({
    queryKey: [TASKS_QUERY_KEY, "detail", taskId],
    queryFn: () => fetchTaskById(taskId!),
    enabled: !!taskId,
    staleTime: 60 * 1000,
  });
}

export type { TaskDTO, TaskListResponse };
