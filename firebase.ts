import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, DatabaseReference } from 'firebase/database';
import { GameState, Team } from './types';

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

export { database, ref, update };
