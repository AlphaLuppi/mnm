import type {
  Routine,
  RoutineListItem,
  RoutineDetail,
  RoutineTrigger,
  RoutineRun,
  CreateRoutine,
  UpdateRoutine,
  CreateRoutineTrigger,
  UpdateRoutineTrigger,
  RunRoutine,
} from "@mnm/shared";
import { api } from "./client";

export type {
  Routine,
  RoutineListItem,
  RoutineDetail,
  RoutineTrigger,
  RoutineRun,
};

export const routinesApi = {
  // Routine CRUD
  list: (companyId: string) =>
    api.get<RoutineListItem[]>(`/companies/${companyId}/routines`),
  get: (companyId: string, routineId: string) =>
    api.get<RoutineDetail>(`/companies/${companyId}/routines/${routineId}`),
  create: (companyId: string, data: CreateRoutine) =>
    api.post<Routine>(`/companies/${companyId}/routines`, data),
  update: (companyId: string, routineId: string, data: UpdateRoutine) =>
    api.patch<Routine>(`/companies/${companyId}/routines/${routineId}`, data),

  // Trigger CRUD
  createTrigger: (companyId: string, routineId: string, data: CreateRoutineTrigger) =>
    api.post<RoutineTrigger>(`/companies/${companyId}/routines/${routineId}/triggers`, data),
  updateTrigger: (companyId: string, triggerId: string, data: UpdateRoutineTrigger) =>
    api.patch<RoutineTrigger>(`/companies/${companyId}/routine-triggers/${triggerId}`, data),
  deleteTrigger: (companyId: string, triggerId: string) =>
    api.delete<void>(`/companies/${companyId}/routine-triggers/${triggerId}`),

  // Run
  run: (companyId: string, routineId: string, data?: RunRoutine) =>
    api.post<RoutineRun>(`/companies/${companyId}/routines/${routineId}/run`, data ?? { source: "manual" }),
  listRuns: (companyId: string, routineId: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return api.get<RoutineRun[]>(`/companies/${companyId}/routines/${routineId}/runs${qs}`);
  },
};
