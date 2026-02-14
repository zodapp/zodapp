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
    signOut,
  };
}
