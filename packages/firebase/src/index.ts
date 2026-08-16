import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";
import firebaseConfig from "../../../firebaseConfig.json";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const storage = firebase.storage();
export const functions = firebase.functions();

// VITE_FIREBASE_EMULATOR=1 で Firebase Emulator Suite に接続する。
// 本番の Firebase プロジェクトを用意しなくてもローカルで一通り動かせる
// （ルートで `pnpm emulator` を起動しておくこと）。
declare const process:
  | { env?: Record<string, string | undefined> }
  | undefined;
const useEmulator =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env?.VITE_FIREBASE_EMULATOR === "1") ||
  (typeof process !== "undefined" &&
    process?.env?.VITE_FIREBASE_EMULATOR === "1");

if (useEmulator) {
  auth.useEmulator("http://127.0.0.1:9099");
  firestore.useEmulator("127.0.0.1", 8080);
  storage.useEmulator("127.0.0.1", 9199);
}

export { firebase };
