/**
 * 画面で使う一覧と Item の hooks。zodapp では Firestore の useList / useDoc / useGrowingList
 * だったものを、zod-dynamodb-react の hooks に置き換える。
 * `live: true` の一覧は Realtime Gateway で購読し、他の利用者の変更もすぐに反映される。
 */
import { createUseItem, createUseList } from "@zodapp/zod-dynamodb-react";
import { api } from "./api";

export const useMyMemberships = createUseList(api.members.mine, { live: true });
export const useMembers = createUseList(api.members.list, { live: true });
export const useMember = createUseItem(api.members.get);
export const useWorkspace = createUseItem(api.workspaces.get);
export const useProjects = createUseList(api.projects.byStatus, { live: true });
export const useProject = createUseItem(api.projects.get);
export const useActiveTasks = createUseList(api.tasks.active, { live: true });
export const useDeletedTasks = createUseList(api.tasks.deleted, { live: true });
export const useTask = createUseItem(api.tasks.get);
