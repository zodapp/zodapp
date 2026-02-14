import { firestore } from "@repo/firebase";
import {
  createUseGrowingList,
  createUseList,
} from "@zodapp/zod-firebase-browser";

// firestore インスタンスをバインドした hooks を作成
export const useGrowingList = createUseGrowingList(firestore);
export const useList = createUseList(firestore);
