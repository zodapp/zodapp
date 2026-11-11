/**
 * zod-form の Resolver。外部キー（回答の「アンケート」「回答者」）の選択肢を、
 * 登録簿のクエリ（@zodapp/zod-form-dynamodb）から読む。
 */
import { createDynamoExternalKeyResolver as createExternalKeyResolver } from "@zodapp/zod-form-dynamodb";
import { api } from "./api";

/** 外部キーの選択肢。登録簿の live なクエリを購読するので、アンケートが増えれば選択肢も増える */
export const createDynamoExternalKeyResolver = () => createExternalKeyResolver(api);
