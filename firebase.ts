import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, DatabaseReference, get } from 'firebase/database';
import { GameState, Team } from './types';

// Firebase 연결 상태 타입
export type FirebaseConnectionStatus = 'connected' | 'permission_denied' | 'disconnected' | 'unknown';

// undefined 값을 재귀적으로 제거 (Firebase는 undefined를 허용하지 않음)
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

// 팀 데이터 정규화 (undefined 배열을 빈 배열로 변환)
const normalizeTeam = (team: any): Team => ({
  id: team.id || '',
  index: team.index || 0,
  name: team.name || '',
  slogan: team.slogan || '',
  members: team.members || [],
  sponsorships: team.sponsorships || [],
  currentRoundPushes: team.currentRoundPushes || [],
  hasSubmittedPushes: team.hasSubmittedPushes || false,
  totalPushAllowance: team.totalPushAllowance || 0,
  totalPoints: team.totalPoints || 0,
  ...(team.miniGameRank !== undefined && { miniGameRank: team.miniGameRank })
});

// 게임 상태 정규화 (Firebase에서 받은 데이터 안전하게 변환)
const normalizeGameState = (data: any): GameState => ({
  ...data,
  teams: (data.teams || []).map(normalizeTeam),
  racers: data.racers || [],
  timer: data.timer || { isRunning: false, totalSeconds: 180, remainingSeconds: 180 },
  revealState: data.revealState || { revealedTeamIds: [] }
});

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDPbbpYUGJs6Xt0hWw__8_6eHIfhhT-oCM",
  authDomain: "yja-survivalracing.firebaseapp.com",
  databaseURL: "https://yja-survivalracing-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "yja-survivalracing",
  storageBucket: "yja-survivalracing.firebasestorage.app",
  messagingSenderId: "408723293686",
  appId: "1:408723293686:web:c6d1be909136be24b6f3d7"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 게임 상태 저장 (undefined 값 제거 후 저장)
export const saveGameState = async (gameState: GameState): Promise<void> => {
  const gameRef = ref(database, `games/${gameState.id}`);
  const cleanedState = removeUndefined(gameState);
  await set(gameRef, cleanedState);
};

// 게임 상태 실시간 구독
export const subscribeToGame = (
  gameId: string,
  callback: (gameState: GameState | null) => void
): (() => void) => {
  const gameRef = ref(database, `games/${gameId}`);
  const unsubscribe = onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    callback(data ? normalizeGameState(data) : null);
  });
  return unsubscribe;
};

// 모든 활성 게임 목록 가져오기
export const subscribeToActiveGames = (
  callback: (games: GameState[]) => void
): (() => void) => {
  const gamesRef = ref(database, 'games');
  const unsubscribe = onValue(gamesRef, (snapshot) => {
    try {
      const data = snapshot.val();
      if (data) {
        const games = Object.values(data) as any[];
        // FINISHED가 아닌 게임만 필터링하고 정규화 (안전하게 체크)
        const activeGames = games
          .filter(g => g && g.status && g.status !== 'FINISHED')
          .map(normalizeGameState);
        callback(activeGames);
      } else {
        callback([]);
      }
    } catch (error) {
      console.error('게임 목록 구독 오류:', error);
      callback([]);
    }
  });
  return unsubscribe;
};

// 팀 정보 업데이트
export const updateTeam = async (
  gameId: string,
  teamId: string,
  updates: Partial<GameState['teams'][0]>
): Promise<void> => {
  const gameRef = ref(database, `games/${gameId}`);
  // 먼저 현재 게임 상태를 가져와서 팀을 업데이트
  // 실제로는 트랜잭션을 사용하는 것이 좋습니다
};

// 팀의 특정 필드만 부분 업데이트 (경쟁 상태 방지)
export const updateTeamPartial = async (
  gameId: string,
  teamIndex: number,
  updates: Partial<Team>
): Promise<void> => {
  // 팀 데이터 경로에 직접 업데이트
  const teamRef = ref(database, `games/${gameId}/teams/${teamIndex}`);
  const cleanedUpdates = removeUndefined(updates);
  await update(teamRef, cleanedUpdates);
};

// 타이머만 부분 업데이트 (팀 데이터 덮어쓰기 방지)
export const updateTimerPartial = async (
  gameId: string,
  timerUpdates: Partial<GameState['timer']>
): Promise<void> => {
  const timerRef = ref(database, `games/${gameId}/timer`);
  const cleanedUpdates = removeUndefined(timerUpdates);
  await update(timerRef, cleanedUpdates);
};

// 게임 삭제
export const deleteGame = async (gameId: string): Promise<void> => {
  const gameRef = ref(database, `games/${gameId}`);
  await remove(gameRef);
};

// 게임 삭제 (별칭)
export const deleteGameState = deleteGame;

// Firebase 연결 상태 확인
export const isFirebaseConfigured = (): boolean => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
};

// Firebase 연결 및 권한 테스트
export const testFirebaseConnection = async (): Promise<{
  status: FirebaseConnectionStatus;
  error?: string;
}> => {
  try {
    // 먼저 읽기 테스트
    const gamesRef = ref(database, 'games');
    await get(gamesRef);

    // 쓰기 테스트 (games 경로 아래에서 테스트 - 규칙에 허용된 경로)
    const testRef = ref(database, 'games/_connection_test');
    await set(testRef, { timestamp: Date.now() });
    await remove(testRef);

    return { status: 'connected' };
  } catch (error: any) {
    const errorMessage = error?.message || '';

    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission_denied')) {
      return {
        status: 'permission_denied',
        error: 'Firebase 권한이 거부되었습니다. Firebase Console에서 Realtime Database 규칙을 확인하세요.'
      };
    }

    if (errorMessage.includes('network') || errorMessage.includes('Network')) {
      return {
        status: 'disconnected',
        error: '네트워크 연결을 확인하세요.'
      };
    }

    return {
      status: 'unknown',
      error: errorMessage
    };
  }
};

// 권한 오류인지 확인
export const isPermissionError = (error: any): boolean => {
  const errorMessage = error?.message || String(error);
  return errorMessage.includes('PERMISSION_DENIED') ||
         errorMessage.includes('permission_denied') ||
         errorMessage.includes('Permission denied');
};

// 게임 상태만 부분 업데이트 (팀 데이터 덮어쓰기 방지)
export const updateGameStatusPartial = async (
  gameId: string,
  updates: {
    status?: string;
    currentRound?: number;
    adminTotalPush?: number;
  }
): Promise<void> => {
  const gameRef = ref(database, `games/${gameId}`);
  const cleanedUpdates = removeUndefined(updates);
  await update(gameRef, cleanedUpdates);
};

// 레이서 데이터만 부분 업데이트
export const updateRacersPartial = async (
  gameId: string,
  racers: any[]
): Promise<void> => {
  const racersRef = ref(database, `games/${gameId}/racers`);
  await set(racersRef, racers);
};

// 공개 상태만 부분 업데이트
export const updateRevealStatePartial = async (
  gameId: string,
  revealState: any
): Promise<void> => {
  const revealRef = ref(database, `games/${gameId}/revealState`);
  const cleanedState = removeUndefined(revealState);
  await set(revealRef, cleanedState);
};

// 팀 데이터를 부분적으로 업데이트 (PUSH 권한 배분용 - 기존 PUSH 데이터 유지)
export const updateTeamsForPushAllocation = async (
  gameId: string,
  teamUpdates: { teamIndex: number; totalPushAllowance: number; miniGameRank?: number }[]
): Promise<void> => {
  const updates: Record<string, any> = {};

  for (const teamUpdate of teamUpdates) {
    updates[`games/${gameId}/teams/${teamUpdate.teamIndex}/totalPushAllowance`] = teamUpdate.totalPushAllowance;
    updates[`games/${gameId}/teams/${teamUpdate.teamIndex}/hasSubmittedPushes`] = false;
    updates[`games/${gameId}/teams/${teamUpdate.teamIndex}/currentRoundPushes`] = [];
    if (teamUpdate.miniGameRank !== undefined) {
      updates[`games/${gameId}/teams/${teamUpdate.teamIndex}/miniGameRank`] = teamUpdate.miniGameRank;
    }
  }

  await update(ref(database), updates);
};

// 여러 필드를 동시에 부분 업데이트 (원자적 업데이트)
export const updateMultipleFieldsPartial = async (
  gameId: string,
  updates: Record<string, any>
): Promise<void> => {
  const prefixedUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    prefixedUpdates[`games/${gameId}/${key}`] = value;
  }
  await update(ref(database), prefixedUpdates);
};

export { database, ref, update };
