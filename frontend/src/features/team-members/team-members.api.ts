import { env } from '../../config/env';
import { requestJson } from '../../lib/api';
import { activeTeamMemberListSchema, type TeamMember } from './team-members.schema';

export async function listActiveTeamMembers(signal: AbortSignal): Promise<TeamMember[]> {
  const body = await requestJson(
    `${env.VITE_API_URL.replace(/\/+$/, '')}/team-members`,
    { headers: { Accept: 'application/json' }, signal },
    'No pudimos consultar los integrantes. Vuelve a intentar.',
  );
  const result = activeTeamMemberListSchema.safeParse(body);
  if (!result.success)
    throw new Error('El catálogo recibido no tiene el formato esperado. Vuelve a intentar.');
  return result.data;
}
