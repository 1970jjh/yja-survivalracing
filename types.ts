// 팀원 역할
export enum UserRole {
  LEADER = '리더',
  STRATEGIST = '전략가',
  PROFILER = '프로파일러',
  RECORDER = '기록자',
  TIME_MANAGER = '시간관리자',
  SUPPORTER = '지지자'
}

// 팀원 정보
export interface TeamMember {
  name: string;
  role: UserRole;
}

// 스폰서십 (5천만, 3천만, 2천만)
export interface Sponsorship {
  racerId: number; // 1-8
  amount: number;  // 50, 30, 20 (백만원 단위)
}

// PUSH 결정
export interface PushDecision {
  racerId: number;
  count: number; // -20 ~ +20
}

// 팀 정보
export interface Team {
  id: string;
  index: number;           // 팀 번호 (1, 2, 3...)
  name: string;            // 팀명
  slogan: string;          // 팀 구호
  members: TeamMember[];   // 팀원 목록
  sponsorships: Sponsorship[]; // 스폰서십 정보
  currentRoundPushes: PushDecision[]; // 현재 라운드 PUSH
  hasSubmittedPushes: boolean;  // PUSH 제출 여부
  totalPushAllowance: number;   // 이번 라운드 PUSH 허용량
  totalPoints: number;          // 최종 수익금
  miniGameRank?: number;        // 미니게임 순위
}

// 레이서 정보
export interface Racer {
  id: number;           // 1-8
  color: string;        // 색상 코드
  position: number;     // 0-20 (21 이상 = 탈락)
  isEliminated: boolean; // 탈락 여부
}

// 게임 상태
export type GameStatus =
  | 'LOBBY'       // 대기실 - 팀 입장 대기
  | 'SPONSORING'  // 스폰서십 입력 단계
  | 'MINI_GAME'   // 미니게임 진행 중
  | 'PUSH_INPUT'  // PUSH 입력 단계
  | 'REVEALING'   // 결과 공개 중 (팀별 순차 공개)
  | 'ROUND_END'   // 라운드 종료
  | 'RESULTS'     // 최종 결과
  | 'FINISHED';   // 게임 완전 종료

// 타이머 상태
export interface TimerState {
  isRunning: boolean;
  totalSeconds: number;    // 전체 시간 (초)
  remainingSeconds: number; // 남은 시간 (초)
  startedAt?: number;       // 시작 시간 (timestamp)
}

// 결과 공개 상태
export interface RevealState {
  revealedTeamIds: string[];  // 공개된 팀 ID 목록
  currentRevealingTeamId?: string; // 현재 공개 중인 팀
}

// 게임 상태 전체
export interface GameState {
  id: string;
  courseName: string;       // 과정명
  maxTeams: number;         // 최대 팀 수 (2-30)
  totalRounds: number;      // 총 라운드 수 (3-10)
  currentRound: number;     // 현재 라운드
  status: GameStatus;       // 게임 상태
  timer: TimerState;        // 타이머 상태
  racers: Racer[];          // 8명의 레이서
  teams: Team[];            // 팀 목록
  adminTotalPush: number;   // 관리자가 설정한 총 PUSH 수
  revealState: RevealState; // 결과 공개 상태
  createdAt: number;        // 생성 시간
  updatedAt: number;        // 마지막 업데이트 시간
}

// 순위별 수익 배수 (1등: 8배, 2등: 7배, ... 8등: 1배, 탈락: 0)
export const RANKING_MULTIPLIERS = [8, 7, 6, 5, 4, 3, 2, 1];

// 스폰서십 금액 (단위: 천만원)
export const SPONSORSHIP_AMOUNTS = [50, 30, 20]; // 5천만, 3천만, 2천만

// 한 레이서에 최대 배분 가능 비율
export const MAX_PUSH_RATIO = 0.5; // 50%

// 최소 배분해야 하는 레이서 수
export const MIN_RACERS_TO_PUSH = 3;
