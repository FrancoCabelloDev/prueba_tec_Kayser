import { Router } from 'express';
import { listActiveTeamMembers } from './team-member.controller.js';

export const teamMemberRouter = Router();

teamMemberRouter.get('/', listActiveTeamMembers);
