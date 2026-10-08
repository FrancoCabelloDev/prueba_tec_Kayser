import type { Request, Response } from 'express';
import type { TeamMemberSummary } from './team-member.repository.js';
import { teamMemberService } from './team-member.service.js';

export async function listActiveTeamMembers(
  _request: Request,
  response: Response<TeamMemberSummary[]>,
) {
  const members = await teamMemberService.listActive();
  response.status(200).json(members);
}
