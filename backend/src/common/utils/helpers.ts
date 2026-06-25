import { v4 as uuidv4 } from 'uuid';

export function generateActivationCode(): string {
  const uuid = uuidv4();
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `${uuid}-${suffix}`;
}

export function generateAgentToken(): string {
  return uuidv4() + uuidv4();
}

export function sanitizeUsername(username: string): string {
  if (!username) return 'unknown';
  if (username.includes('\\')) {
    return username.split('\\')[1];
  }
  return username;
}
