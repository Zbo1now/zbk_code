export interface AuthUser {
  userId: number;
  username: string;
  displayName?: string | null;
  enabled: boolean;
  roles: string[];
  permissions: string[];
}

const ACCESS_TOKEN_KEY = 'knowledge_access_token';

export const getAccessToken = () => {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY) || window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string, remember = true) => {
  try {
    clearAccessToken();
    if (remember) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
  } catch {
    // ignore
  }
};

export const clearAccessToken = () => {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const isAdminUser = (user: AuthUser | null) => {
  if (!user) return false;
  return user.roles.includes('ADMIN');
};

export const hasPermission = (user: AuthUser | null, permission: string) => {
  if (!user) return false;
  return user.roles.includes('ADMIN') || user.permissions.includes(permission);
};

export const authFetch: typeof fetch = async (input, init = {}) => {
  const token = getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearAccessToken();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  return response;
};
