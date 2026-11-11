/**
 * ログイン状態と認証の操作。zodapp の Firebase Auth 版と同じ形で、中身を Amplify（Cognito）にする。
 */
import { useCallback, useEffect, useState } from "react";
import { Hub } from "aws-amplify/utils";
import {
  confirmResetPassword,
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut as amplifySignOut,
  signUp,
} from "aws-amplify/auth";
import { authFlowType } from "../amplify";

export type User = {
  /** Cognito の sub */
  uid: string;
  email: string;
  displayName: string | null;
};

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export interface AuthActions {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** 確認コードの入力が必要なら true を返す */
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUpWithCode: (email: string, code: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

const toError = (err: unknown, fallback: string) =>
  err instanceof Error ? err : new Error(fallback);

const loadUser = async (): Promise<User | null> => {
  try {
    const current = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    return {
      uid: current.userId,
      email: (attributes.email ?? current.signInDetails?.loginId ?? "").toLowerCase(),
      displayName: attributes.name ?? null,
    };
  } catch {
    return null;
  }
};

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      loadUser().then((u) => {
        if (!active) return;
        setUser(u);
        setLoading(false);
      });
    void refresh();
    const stop = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signedIn" || payload.event === "signedOut") void refresh();
    });
    return () => {
      active = false;
      stop();
    };
  }, []);

  const run = useCallback(
    async <T,>(fallback: string, fn: () => Promise<T>): Promise<T> => {
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const e = toError(err, fallback);
        setError(e);
        throw e;
      }
    },
    [],
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      run("ログインに失敗しました", async () => {
        const result = await signIn({
          username: email,
          password,
          options: { authFlowType },
        });
        if (!result.isSignedIn) {
          throw new Error(`ログインを完了できません（${result.nextStep.signInStep}）`);
        }
        setUser(await loadUser());
      }),
    [run],
  );

  const signUpWithEmail = useCallback(
    (email: string, password: string, displayName?: string) =>
      run("登録に失敗しました", async () => {
        const result = await signUp({
          username: email,
          password,
          options: {
            userAttributes: { email, ...(displayName ? { name: displayName } : {}) },
          },
        });
        return { needsConfirmation: result.nextStep.signUpStep === "CONFIRM_SIGN_UP" };
      }),
    [run],
  );

  const confirmSignUpWithCode = useCallback(
    (email: string, code: string) =>
      run("確認に失敗しました", async () => {
        await confirmSignUp({ username: email, confirmationCode: code });
      }),
    [run],
  );

  const sendPasswordReset = useCallback(
    (email: string) =>
      run("パスワード再設定のメールの送信に失敗しました", async () => {
        await resetPassword({ username: email });
      }),
    [run],
  );

  const confirmPasswordReset = useCallback(
    (email: string, code: string, newPassword: string) =>
      run("パスワードの再設定に失敗しました", async () => {
        await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      }),
    [run],
  );

  const signOut = useCallback(
    () =>
      run("ログアウトに失敗しました", async () => {
        await amplifySignOut();
        setUser(null);
      }),
    [run],
  );

  return {
    user,
    loading,
    error,
    signInWithEmail,
    signUpWithEmail,
    confirmSignUpWithCode,
    sendPasswordReset,
    confirmPasswordReset,
    signOut,
  };
}
