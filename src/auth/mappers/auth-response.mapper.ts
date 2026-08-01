export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUserResponse;
}

export function mapUserToAuthResponse(user: {
  id: string;
  email: string;
  fullName: string;
}): AuthUserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
  };
}
