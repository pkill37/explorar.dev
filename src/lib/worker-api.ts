// Client utilities for calling Cloudflare Worker API

const WORKER_API_URL =
  process.env.NEXT_PUBLIC_WORKER_API_URL || 'https://shared-data-store-api.fabiu-maia.workers.dev';

export interface User {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
  name: string | null;
  created_at: string;
}

export interface StarredRepo {
  repo_owner: string;
  repo_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  starred_at: string;
}

export interface FollowingUser {
  following_user_id: number;
  following_login: string;
  following_avatar_url: string;
  followed_at: string;
}

export interface FollowerUser {
  follower_user_id: number;
  follower_login: string;
  follower_avatar_url: string;
  followed_at: string;
}

export interface ExploredRepo {
  repo_owner: string;
  repo_name: string;
  explored_at: string;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(`${WORKER_API_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

export async function exchangeAuthCode(code: string): Promise<{
  token: string;
  user: User;
}> {
  const response = await fetch(`${WORKER_API_URL}/api/auth/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Authentication failed');
  }

  const data = await response.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await fetchWithAuth('/api/user');

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user');
  }

  return response.json();
}

export async function getUserStars(): Promise<StarredRepo[]> {
  const response = await fetchWithAuth('/api/user/stars');

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get stars');
  }

  const data = await response.json();
  return data.stars || [];
}

export async function getUserFollowing(): Promise<FollowingUser[]> {
  const response = await fetchWithAuth('/api/user/following');

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get following');
  }

  const data = await response.json();
  return data.following || [];
}

export async function getUserFollowers(): Promise<FollowerUser[]> {
  const response = await fetchWithAuth('/api/user/followers');

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get followers');
  }

  const data = await response.json();
  return data.followers || [];
}

export async function trackExploredRepo(repoOwner: string, repoName: string): Promise<void> {
  const response = await fetchWithAuth('/api/user/explored-repos', {
    method: 'POST',
    body: JSON.stringify({
      repo_owner: repoOwner,
      repo_name: repoName,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to track explored repo');
  }
}

export async function getExploredRepos(): Promise<ExploredRepo[]> {
  const response = await fetchWithAuth('/api/user/explored-repos');

  if (!response.ok) {
    if (response.status === 401) {
      removeAuthToken();
      throw new Error('Unauthorized');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to get explored repos');
  }

  const data = await response.json();
  return data.repos || [];
}

export async function addToWaitlist(email: string): Promise<void> {
  const response = await fetch(`${WORKER_API_URL}/api/waitlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add to waitlist');
  }
}

export function getGitHubOAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'https://explorar.dev/auth/callback';

  // Store state in sessionStorage for CSRF protection
  const state = Math.random().toString(36).substring(7);
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}
