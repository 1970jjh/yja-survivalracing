import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, DatabaseReference } from 'firebase/database';
import { GameState } from './types';

// ⚠️ Firebase 설정을 여기에 붙여넣으세요!
// Firebase Console에서 복사한 설정으로 교체하세요.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 게임 상태 저장
export const saveGameState = async (gameState: GameState): Promise<void> => {
  const gameRef = ref(database, `games/${gameState.id}`);
  await set(gameRef, gameState);
};

// 게임 상태 실시간 구독
export const subscribeToGame = (
  gameId: string,
  callback: (gameState: GameState | null) => void
): (() => void) => {
  const gameRef = ref(database, `games/${gameId}`);
  const unsubscribe = onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    callback(data);
  });
  return unsubscribe;
};

// 모든 활성 게임 목록 가져오기
export const subscribeToActiveGames = (
  callback: (games: GameState[]) => void
): (() => void) => {
  const gamesRef = ref(database, 'games');
  const unsubscribe = onValue(gamesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const games = Object.values(data) as GameState[];
      // FINISHED가 아닌 게임만 필터링
      const activeGames = games.filter(g => g.status !== 'FINISHED');
      callback(activeGames);
    } else {
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

// 게임 삭제
export const deleteGame = async (gameId: string): Promise<void> => {
  const gameRef = ref(database, `games/${gameId}`);
  await remove(gameRef);
};

// Firebase 연결 상태 확인
export const isFirebaseConfigured = (): boolean => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY";
};

export { database, ref, update };
