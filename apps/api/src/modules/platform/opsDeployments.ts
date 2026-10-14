/** Deployments and server control through Coolify (sanitised; see lib/coolify.ts). */
import type {
  CoolifyNotConfigured,
  DeployActionResult,
  DeployedApp,
  DeploymentList,
  DeploymentLogs,
} from '@classiq/shared';
import * as coolify from '../../lib/coolify.js';

const notConfigured = (): CoolifyNotConfigured => ({ configured: false, instructions: coolify.COOLIFY_SETUP_INSTRUCTIONS });

export const runningVersion = () => (process.env.SOURCE_COMMIT ? process.env.SOURCE_COMMIT.slice(0, 7) : 'dev');

export async function getApp(): Promise<DeployedApp | CoolifyNotConfigured> {
  const cfg = coolify.coolifyConfig();
  if (!cfg) return notConfigured();
  const [app, recent] = await Promise.all([coolify.getApplication(cfg), coolify.listDeployments(cfg, 10).catch(() => [])]);
  const sha = app.gitCommitSha && app.gitCommitSha !== 'HEAD' ? app.gitCommitSha.slice(0, 7) : null;
  const lastFinished = recent.find((d) => d.status === 'finished');
  return {
    configured: true,
    name: app.name,
    status: app.status,
    fqdn: app.fqdn,
    gitBranch: app.gitBranch,
    currentCommit: sha ?? lastFinished?.commit ?? null,
    lastOnlineAt: app.lastOnlineAt,
    runningVersion: runningVersion(),
  };
}

export async function listDeployments(): Promise<DeploymentList | CoolifyNotConfigured> {
  const cfg = coolify.coolifyConfig();
  if (!cfg) return notConfigured();
  return { configured: true, items: await coolify.listDeployments(cfg, 20) };
}

export async function deploymentLogs(id: string): Promise<DeploymentLogs | CoolifyNotConfigured> {
  const cfg = coolify.coolifyConfig();
  if (!cfg) return notConfigured();
  return { configured: true, ...(await coolify.getDeploymentLogs(cfg, id, 300)) };
}

export async function redeploy(): Promise<DeployActionResult | CoolifyNotConfigured> {
  const cfg = coolify.coolifyConfig();
  if (!cfg) return notConfigured();
  const deploymentId = await coolify.deploy(cfg);
  return { configured: true, ok: true, deploymentId, message: 'Deployment queued. The new version goes live when the build finishes.' };
}

export async function restart(): Promise<DeployActionResult | CoolifyNotConfigured> {
  const cfg = coolify.coolifyConfig();
  if (!cfg) return notConfigured();
  const deploymentId = await coolify.restart(cfg);
  return { configured: true, ok: true, deploymentId, message: 'Restart requested. The app is briefly unavailable while containers restart.' };
}
