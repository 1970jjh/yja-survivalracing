
export enum UserRole {
  LEADER = '리더',
  STRATEGIST = '전략가',
  PROFILER = '프로파일러',
  RECORDER = '기록자',
  TIME_MANAGER = '시간관리자',
  SUPPORTER = '지지자'
}

export interface TeamMember {
  name: string;
  role: UserRole;
}

export interface Sponsorship {
  racerId: number; // 1-8
  amount: number; // 50, 30, 20 (millions)
}

export interface PushDecision {
  racerId: number;
  count: number;
}

export interface Team {
  id: string;
  index: number; // Team number (e.g., 1 for Team 1)
  name: string;
  slogan: string;
  members: TeamMember[];
  sponsorships: Sponsorship[];
  currentRoundPushes: PushDecision[];
  hasSubmittedPushes: boolean;
  totalPushAllowance: number;
  totalPoints: number;
}

export interface Racer {
  id: number;
  color: string;
  position: number; // 0 to 20
  isEliminated: boolean;
}

export interface GameState {
  id: string;
  courseName: string;
  maxTeams: number;
  totalRounds: number;
  currentRound: number;
  status: 'LOBBY' | 'SPONSORING' | 'MINI_GAME' | 'PUSH_INPUT' | 'RESULTS' | 'FINISHED';
  timer: number;
  racers: Racer[];
  teams: Team[];
  adminTotalPush: number; // Admin provided total push points
}
