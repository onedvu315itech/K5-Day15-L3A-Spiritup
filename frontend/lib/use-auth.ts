"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import type { AuthUser } from "./auth-api";
import { ApiError } from "./types";

interface AuthSnapshot {
  user: AuthUser | null;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  initialized: boolean;
}

const SERVER_SNAPSHOT: AuthSnapshot = {
  user: null,
  loading: true,
  submitting: false,
  error: null,
  initialized: false,
};

let state: AuthSnapshot = {
  user: null,
  loading: true,
  submitting: false,
  error: null,
  initialized: false,
};

let initPromise: Promise<AuthUser | null> | null = null;
const listeners = new Set<() => void>();

function emit(patch: Partial<AuthSnapshot>) {
  state = { ...state, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthSnapshot {
  return state;
}

function getServerSnapshot(): AuthSnapshot {
  return SERVER_SNAPSHOT;
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  emit({ loading: true });
  try {
    const user = await api.auth.me();
    emit({ user, loading: false, initialized: true, error: null });
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      emit({ user: null, loading: false, initialized: true });
      return null;
    }
    emit({
      user: null,
      loading: false,
      initialized: true,
    });
    return null;
  }
}

function ensureInitialized() {
  if (typeof window === "undefined" || state.initialized || initPromise) {
    return;
  }
  initPromise = fetchCurrentUser().finally(() => {
    initPromise = null;
  });
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export function useAuth() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    ensureInitialized();
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<AuthUser | null> => {
    emit({ submitting: true, error: null });
    try {
      const user = await api.auth.login({
        email: input.email.trim(),
        password: input.password,
        remember_me: input.rememberMe ?? true,
      });
      emit({
        user,
        submitting: false,
        loading: false,
        initialized: true,
        error: null,
      });
      return user;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể đăng nhập. Vui lòng thử lại.";
      emit({ submitting: false, error: message });
      return null;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    emit({ submitting: true, error: null });
    try {
      await api.auth.logout();
      emit({ user: null, submitting: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể đăng xuất. Vui lòng thử lại.";
      emit({ submitting: false, error: message });
    }
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    return fetchCurrentUser();
  }, []);

  const clearError = useCallback(() => {
    if (state.error !== null) {
      emit({ error: null });
    }
  }, []);

  return {
    user: snapshot.user,
    loading: snapshot.loading,
    submitting: snapshot.submitting,
    error: snapshot.error,
    login,
    logout,
    refresh,
    clearError,
  };
}
