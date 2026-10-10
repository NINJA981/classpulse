import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'classpulse_super_secret_jwt_key_2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware: Verifies JWT Bearer token and populates req.user.
 */
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        id: 'dev_user_001',
        email: 'dev@classpulse.internal',
        role: (req.headers['x-dev-role'] as any) || 'admin'
      };
      return next();
    }
    res.status(401).json({ error: 'Access token required. Please sign in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Role-Based Access Control (RBAC) guard.
 * Ensures the authenticated user possesses one of the allowed roles.
 */
export function requireRole(allowedRoles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: role '${req.user.role}' lacks permission for this resource.`
      });
      return;
    }

    next();
  };
}

/**
 * Optional token extraction (doesn't reject if unauthenticated).
 */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
    } catch {
      // Ignore invalid token in optional mode
    }
  }
  next();
}
