/**
 * 画面で使う一覧と Item の hooks。zodapp では Firestore の useList / useDoc だったものを、
 * zod-dynamodb-react の hooks に置き換える。
 * `live: true` の一覧は Realtime Gateway で購読し、他の利用者の変更もすぐに反映される。
 */
import { createUseItem, createUseList } from "@zodapp/zod-dynamodb-react";
import { api } from "./api";

export const useMyMemberships = createUseList(api.members.mine, { live: true });
export const useMembers = createUseList(api.members.list, { live: true });
export const useMember = createUseItem(api.members.get);
export const useWorkspace = createUseItem(api.workspaces.get);
export const useActiveSurveys = createUseList(api.surveys.active, { live: true });
export const useSurvey = createUseItem(api.surveys.get);
export const useResponse = createUseItem(api.responses.get);

type SurveyKey = Parameters<typeof api.surveys.get>[0];

/** アンケートを選んでいないとき（key が undefined）は読まずに null を返す */
export const useOptionalSurvey = createUseItem(
  (key: SurveyKey | undefined, options: { withToken: true }) =>
    key
      ? api.surveys.get(key, options)
      : Promise.resolve({ item: null, token: undefined }),
);
