/**
 * Proxy sanity check. Rate limits, the audit log and the device list all rely on `req.ip` being the
 * real client address, which needs every proxy in front of the API to pass X-Forwarded-For along
 * (TRUST_PROXY_HOPS). When a proxied request still resolves to a private address in production, a
 * proxy is replacing the header: every visitor then shares one rate-limit bucket. We log that once.
 */
import { BlockList, isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { env, isProd } from '../config/env.js';
import { logger } from './logger.js';

const privateRanges = new BlockList();
for (const [net, prefix] of [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['100.64.0.0', 10],
] as const) {
  privateRanges.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  privateRanges.addSubnet(net, prefix, 'ipv6');
}

/** Whether `ip` is a loopback, private, link-local or carrier-grade NAT address. */
export function isPrivateIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  const addr = mapped ?? ip;
  const family = isIP(addr);
  if (family === 4) return privateRanges.check(addr, 'ipv4');
  if (family === 6) return privateRanges.check(addr, 'ipv6');
  return false;
}

let warning: string | null = null;

/** The proxy misconfiguration seen since startup, if any (for health/status reporting). */
export const clientIpWarning = (): string | null => warning;

/** Startup check: in production the API always sits behind at least one proxy. */
export function checkProxyConfig(): void {
  if (isProd && env.TRUST_PROXY_HOPS === 0) {
    logger.warn('TRUST_PROXY_HOPS=0 in production: every client will appear as the proxy address');
  }
}

/**
 * Middleware: a request that came through a proxy (it carries X-Forwarded-For) but still resolves to
 * a private address means a proxy hop is not trusted. Logged once. Health checks and internal calls
 * (no X-Forwarded-For) are ignored.
 */
export function watchClientIp(req: Request, _res: Response, next: NextFunction): void {
  if (isProd && warning === null && req.headers['x-forwarded-for'] !== undefined && isPrivateIp(req.ip)) {
    warning = `Public requests arrive with the private client address ${req.ip}. A proxy in front of the API is replacing X-Forwarded-For (check TRUST_PROXY_HOPS=${env.TRUST_PROXY_HOPS} and the router's trusted_proxies); rate limits and audit IPs are shared by every visitor.`;
    logger.warn({ ip: req.ip, trustProxyHops: env.TRUST_PROXY_HOPS }, warning);
  }
  next();
}
