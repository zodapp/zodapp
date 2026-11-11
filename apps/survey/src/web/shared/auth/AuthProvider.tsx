import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiProvider } from "@zodapp/zod-dynamodb-react";
import { anonymous, type Auth, type MemberRole } from "../../../shared";
import { api } from "../api";
import { useAuth, type UseAuthReturn } from "./useAuth";

type AuthContextValue = UseAuthReturn & {
  /** 操作の認可に使う認証コンテキスト（ロールは自分の所属一覧から） */
  appAuth: Auth;
  /** 所属一覧を読み終えたか */
  rolesReady: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * ログインしている間、自分の所属一覧（members.mine）を購読してロールを保つ。
 * ブラウザの `can` は、このロールで判定する。サーバーはリクエストごとに同じものを引く。
 */
const useRoles = (userId: string | undefined) => {
  const [state, setState] = useState<{ roles: Record<string, MemberRole>; ready: boolean }>({
    roles: {},
    ready: false,
  });
  useEffect(() => {
    if (!userId) {
      setState({ roles: {}, ready: false });
      return;
    }
    const store = api.members.mine.live({});
    const update = () => {
      const s = store.getState();
      if (s.status !== "ready") return;
      setState({
        roles: Object.fromEntries(s.items.map((m) => [m.workspaceId, m.role])),
        ready: true,
      });
    };
    const off = store.subscribe(update);
    update();
    return () => {
      off();
      store.close();
    };
  }, [userId]);
  return state;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { roles, ready } = useRoles(auth.user?.uid);
  const appAuth = useMemo<Auth>(
    () =>
      auth.user
        ? { userId: auth.user.uid, email: auth.user.email, roles }
        : anonymous,
    [auth.user, roles],
  );
  const value = useMemo(
    () => ({ ...auth, appAuth, rolesReady: ready }),
    [auth, appAuth, ready],
  );

  return (
    <AuthContext.Provider value={value}>
      <ApiProvider api={api} context={appAuth}>
        {children}
      </ApiProvider>
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
