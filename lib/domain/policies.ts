import type { RequestStatus, Role } from './types';

const transitions: Record<RequestStatus, RequestStatus[]> = {
  new: ['needs_info', 'family_check', 'connecting', 'rejected'], needs_info: ['family_check', 'connecting', 'rejected'], family_check: ['connecting', 'rejected'], connecting: ['completed', 'needs_info', 'rejected'], completed: [], rejected: [],
};
export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean { return transitions[from].includes(to); }
export function canViewSenior(actor: Role, relationActive: boolean, consentActive: boolean): boolean { return actor === 'senior' || (relationActive && consentActive); }
export function needsConfirmation(token?: string): boolean { return token !== 'confirmed'; }
