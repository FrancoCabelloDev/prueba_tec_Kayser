import { useEffect, useState } from 'react';
import { listActiveTeamMembers } from './team-members.api';
import type { TeamMember } from './team-members.schema';

type CatalogState =
  | { status: 'loading'; members: TeamMember[] }
  | { status: 'ready'; members: TeamMember[] }
  | { status: 'error'; members: TeamMember[]; message: string };

export function useTeamMembers() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CatalogState>({ status: 'loading', members: [] });
  useEffect(() => {
    const controller = new AbortController();
    void listActiveTeamMembers(controller.signal).then(
      (members) => {
        if (!controller.signal.aborted) setState({ status: 'ready', members });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            members: [],
            message: error instanceof Error ? error.message : 'No pudimos cargar los integrantes.',
          });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  function retry() {
    setState({ status: 'loading', members: [] });
    setAttempt((current) => current + 1);
  }
  return { ...state, retry };
}
