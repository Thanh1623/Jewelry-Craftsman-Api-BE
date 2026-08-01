export interface JwtPayloadUser {
  sub: string;
  email: string;
  fullName: string;
  role?: string;
}
