import jwt from 'jsonwebtoken';

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: EXPIRES_IN } as jwt.SignOptions);

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
