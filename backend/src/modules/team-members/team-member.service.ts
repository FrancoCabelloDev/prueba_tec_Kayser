import { teamMemberRepository } from './team-member.repository.js';

export const teamMemberService = {
  listActive() {
    return teamMemberRepository.listActive();
  },
};
