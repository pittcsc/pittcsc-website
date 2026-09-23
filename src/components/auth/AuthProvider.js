import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { createAuthStore } from "../../lib/auth/store.mjs";
import { getAuthClient, fetchIdentity } from "../../lib/auth/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [store] = useState(() =>
    createAuthStore({ getClient: getAuthClient, fetchIdentity }),
  );
  useEffect(() => {
    void store.start();
    return () => store.stop();
  }, [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const store = useContext(AuthContext);
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  return {
    ...state,
    retry: store.retry,
    signOut: store.signOut,
    requestCode: store.requestCode,
    verifyCode: store.verifyCode,
  };
}

export const wrapRootElement = ({ element }) => (
  <AuthProvider>{element}</AuthProvider>
);
