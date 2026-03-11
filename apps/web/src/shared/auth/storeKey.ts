import { useMemo } from "react";
import type { AccessorStoreKey } from "@zodapp/zod-firebase-browser";
import { useAuthContext } from "./AuthProvider";

type DebugStoreKey = {
  uid?: string;
  createdAt: Date;
};

let currentUid: string | undefined;
let currentStoreKey: DebugStoreKey | undefined;

export function getStoreKey(uid?: string): AccessorStoreKey {
  if (currentStoreKey && currentUid === uid) {
    return currentStoreKey;
  }
  currentUid = uid;
  currentStoreKey = { uid, createdAt: new Date() };
  return currentStoreKey;
}

export function useStoreKey(): AccessorStoreKey {
  const { user } = useAuthContext();
  return useMemo(() => getStoreKey(user?.uid), [user?.uid]);
}
