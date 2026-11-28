import { ApiError, type ApiErrorBody } from "./types";

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export interface AuthLoginPayload {
  email: string;
  password: string;
  remember_me?: boolean;
}

interface UserEnvelope {
  user: AuthUser;
}

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/auth${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Không kết nối được tới máy chủ xác thực. Kiểm tra lại mạng hoặc trạng thái backend.",
    );
  }

  if (!response.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      parsed = null;
    }
    const err = parsed?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "http_error",
      err?.message ?? `Yêu cầu thất bại (mã ${response.status}).`,
      err?.details,
    );
  }

  return (await response.json()) as T;
}

export const authApi = {
  async login(payload: AuthLoginPayload): Promise<AuthUser> {
    const res = await authRequest<UserEnvelope>("/login", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        remember_me: payload.remember_me ?? true,
      }),
    });
    return res.user;
  },

  async me(): Promise<AuthUser> {
    const res = await authRequest<UserEnvelope>("/me", {
      method: "GET",
    });
    return res.user;
  },

  async refresh(): Promise<AuthUser> {
    const res = await authRequest<UserEnvelope>("/refresh", {
      method: "POST",
    });
    return res.user;
  },

  async logout(): Promise<void> {
    await authRequest<{ ok: boolean }>("/logout", {
      method: "POST",
    });
  },
};
