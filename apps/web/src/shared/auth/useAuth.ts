import { useState, useEffect, useCallback } from "react";
import { auth, firebase } from "@repo/firebase";

export type User = firebase.User;

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("認証に失敗しました"));
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await auth.signInWithEmailAndPassword(email, password);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("ログインに失敗しました"),
        );
        throw err;
      }
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setError(null);
      try {
        const credential = await auth.createUserWithEmailAndPassword(
          email,
          password,
        );
        if (displayName && credential.user) {
          await credential.user.updateProfile({ displayName });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("登録に失敗しました"),
        );
        throw err;
      }
    },
    [],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      await auth.sendPasswordResetEmail(email);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("パスワードリセットメールの送信に失敗しました"),
      );
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("ログアウトに失敗しました"));
      throw err;
    }
  }, []);

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    signOut,
  };
}
