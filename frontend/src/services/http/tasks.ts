/**
 * Tasks HTTP Service
 * Minimal service for task selection in quote creation
 */

import { get } from "./client";

const TASKS_ENDPOINT = "/tasks";

export interface TaskDTO {
  id: string;
  task_number: string;
  client_name: string;
  status: string;
  address_city?: string;
  created_at: string;
}

export interface TaskListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TaskDTO[];
}

/**
 * Fetch tasks list (active only)
 */
export async function fetchTasks(
  status?: string
): Promise<TaskListResponse> {
  return get<TaskListResponse>(TASKS_ENDPOINT, {
    params: status ? { status } : { status: "quoting" }, // Default to quoting tasks
  });
}

/**
 * Fetch single task by ID
 */
export async function fetchTaskById(taskId: string): Promise<TaskDTO> {
  return get<TaskDTO>(`${TASKS_ENDPOINT}/${taskId}/`);
}
