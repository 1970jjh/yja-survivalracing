import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Team, TeamMember, TimerState, RevealState } from './types';
import { RACER_COLORS } from './constants';
import { saveGameState, subscribeToActiveGames, isFirebaseConfigured, deleteGameState, updateTeamPartial, testFirebaseConnection, isPermissionError, FirebaseConnectionStatus } from './firebase';
import Lobby from './components/Lobby';
import AdminSetup from './components/AdminSetup';
import AdminDashboard from './components/AdminDashboard';
import TeamJoin from './components/TeamJoin';
import TeamSponsorship from './components/TeamSponsorship';
import TeamPushControl from './components/TeamPushControl';
import TeamMiniGameWaiting from './components/TeamMiniGameWaiting';
import Notification from './components/Notification';

// 로컬 동기화용 BroadcastChannel (같은 브라우저 탭 간)
const SYNC_CHANNEL = new BroadcastChannel('survival_racing_sync');

// 세션 저장 키
const SESSION_KEY = 'survival_racing_session';

interface SessionData {
  gameId: string;
  teamId: string;
  teamIndex: number;
  view: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'ADMIN_SETUP' | 'ADMIN_DASHBOARD' | 'TEAM_JOIN' | 'TEAM_DASHBOARD' | 'ADMIN_PREVIEW_USER'>('HOME');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeGames, setActiveGames] = useState<GameState[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'error'} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useFirebase, setUseFirebase] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionStatus>('unknown');
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Ref to always have the latest gameState (avoids stale closures)
  const gameStateRef = useRef<GameState | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 세션 저장
  const saveSession = useCallback((data: SessionData | null) => {
    if (data) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // 세션 복원
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        const session: SessionData = JSON.parse(savedSession);
        setCurrentGameId(session.gameId);
        setMyTeamId(session.teamId);
        setSelectedTeamIndex(session.teamIndex);
        if (session.view === 'TEAM_DASHBOARD' || session.view === 'TEAM_JOIN') {
          setView(session.view as 'TEAM_DASHBOARD' | 'TEAM_JOIN');
        }
      } catch (e) {
        console.error('세션 복원 실패:', e);
      }
    }
  }, []);

  // Firebase 설정 확인 및 연결 테스트
  useEffect(() => {
    const checkFirebase = async () => {
      const configured = isFirebaseConfigured();
      if (configured) {
        // Firebase 연결 및 권한 테스트
        const result = await testFirebaseConnection();
        setFirebaseStatus(result.status);

        if (result.status === 'connected') {
          setUseFirebase(true);
          setFirebaseError(null);
        } else if (result.status === 'permission_denied') {
          setUseFirebase(false);
          setFirebaseError(result.error || 'Firebase 권한 오류');
          showNotification('Firebase 권한 오류! 오프라인 모드로 전환합니다.', 'error');
        } else {
          setUseFirebase(false);
          setFirebaseError(result.error || '연결 오류');
        }
      } else {
        setUseFirebase(false);
      }
    };
    checkFirebase();
  }, []);

  // 활성 게임 목록 구독 (Firebase 사용 시)
  useEffect(() => {
    if (useFirebase) {
      const unsubscribe = subscribeToActiveGames((games) => {
        setActiveGames(games);
        // 현재 참여 중인 게임이 있으면 업데이트
        if (currentGameId) {
          const currentGame = games.find(g => g.id === currentGameId);
          if (currentGame) {
            setGameState(currentGame);
          }
        }
      });
      return unsubscribe;
    } else {
      // localStorage 사용
      const saved = localStorage.getItem('survival_racing_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        setGameState(parsed);
        setActiveGames(parsed ? [parsed] : []);
      }
    }
  }, [useFirebase, currentGameId]);

  // 로컬 동기화 리스너
  useEffect(() => {
    if (!useFirebase) {
      const handleSync = (event: MessageEvent) => {
        const newState = event.data as GameState | null;
        setGameState(newState);
        setActiveGames(newState ? [newState] : []);
        setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 500);
      };

      SYNC_CHANNEL.onmessage = handleSync;

      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'survival_racing_state') {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          setGameState(parsed);
          setActiveGames(parsed ? [parsed] : []);
        }
      };

      window.addEventListener('storage', handleStorage);

      return () => {
        SYNC_CHANNEL.onmessage = null;
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [useFirebase]);

  // 게임 상태 업데이트 함수
  const updateGameState = useCallback(async (newState: GameState | null, broadcast = true) => {
    if (!newState) {
      setGameState(null);
      if (!useFirebase) {
        localStorage.removeItem('survival_racing_state');
        if (broadcast) SYNC_CHANNEL.postMessage(null);
      }
      return;
    }

    // 업데이트 시간 갱신
    const updatedState = { ...newState, updatedAt: Date.now() };
    setGameState(updatedState);
    setActiveGames(prev => {
      const idx = prev.findIndex(g => g.id === updatedState.id);
      if (idx >= 0) {
        const newGames = [...prev];
        newGames[idx] = updatedState;
        return newGames;
      }
      return [...prev, updatedState];
    });

    if (useFirebase) {
      try {
        await saveGameState(updatedState);
      } catch (error) {
        console.error('Firebase 저장 실패:', error);
        if (isPermissionError(error)) {
          setFirebaseStatus('permission_denied');
          setFirebaseError('Firebase 권한이 거부되었습니다.');
          setUseFirebase(false);
          showNotification('Firebase 권한 오류! 오프라인 모드로 전환합니다. Firebase Console에서 Database Rules를 확인하세요.', 'error');
          // 오프라인 모드로 저장
          localStorage.setItem('survival_racing_state', JSON.stringify(updatedState));
          if (broadcast) SYNC_CHANNEL.postMessage(updatedState);
        } else {
          showNotification('동기화 실패. 다시 시도해주세요.', 'error');
        }
      }
    } else {
      localStorage.setItem('survival_racing_state', JSON.stringify(updatedState));
      if (broadcast) SYNC_CHANNEL.postMessage(updatedState);
    }
  }, [useFirebase]);

  // 알림 표시
  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 팀 업데이트 함수 (Firebase 부분 업데이트 사용 - 경쟁 상태 방지)
  const updateTeam = useCallback(async (teamId: string, update: Partial<Team>) => {
    const currentState = gameStateRef.current;
    if (!currentState) return;

    const teams = currentState.teams || [];
    const teamIndex = teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return;

    // Firebase 사용 중이고 PUSH 관련 업데이트인 경우 부분 업데이트 사용
    if (useFirebase && (update.hasSubmittedPushes !== undefined || update.currentRoundPushes !== undefined)) {
      try {
        await updateTeamPartial(currentState.id, teamIndex, update);
        // Firebase가 자동으로 구독을 통해 상태를 업데이트해줌
        console.log('팀 부분 업데이트 성공:', teamId, update);
      } catch (error) {
        console.error('팀 부분 업데이트 실패:', error);
        if (isPermissionError(error)) {
          setFirebaseStatus('permission_denied');
          setUseFirebase(false);
          showNotification('Firebase 권한 오류! Firebase Console에서 Database Rules를 확인하세요.', 'error');
        } else {
          showNotification('제출 실패. 다시 시도해주세요.', 'error');
        }
      }
    } else {
      // 기존 방식: 전체 상태 업데이트
      const newTeams = teams.map(t =>
        t.id === teamId ? { ...t, ...update } : t
      );
      updateGameState({ ...currentState, teams: newTeams });
    }
  }, [updateGameState, useFirebase]);

  // 게임 생성
  const createGame = (courseName: string, teamCount: number, rounds: number) => {
    const now = Date.now();
    const initialTimer: TimerState = {
      isRunning: false,
      totalSeconds: 180,
      remainingSeconds: 180
    };
    const initialReveal: RevealState = {
      revealedTeamIds: []
    };

    const initialState: GameState = {
      id: Math.random().toString(36).substr(2, 9),
      courseName,
      maxTeams: teamCount,
      totalRounds: rounds,
      currentRound: 1,
      status: 'LOBBY',
      timer: initialTimer,
      racers: Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        color: RACER_COLORS[i],
        position: 0,
        isEliminated: false
      })),
      teams: [],
      adminTotalPush: 12,
      revealState: initialReveal,
      createdAt: now,
      updatedAt: now
    };

    updateGameState(initialState);
    setCurrentGameId(initialState.id);
    setView('ADMIN_DASHBOARD');
    showNotification(`"${courseName}" 게임이 생성되었습니다!`, 'info');
  };

  // 게임 삭제
  const handleDeleteGame = async (gameId: string) => {
    if (useFirebase) {
      try {
        await deleteGameState(gameId);
        setActiveGames(prev => prev.filter(g => g.id !== gameId));
        showNotification('게임이 삭제되었습니다.', 'info');
      } catch (error) {
        console.error('게임 삭제 실패:', error);
        showNotification('게임 삭제에 실패했습니다.', 'error');
      }
    } else {
      localStorage.removeItem('survival_racing_state');
      setGameState(null);
      setActiveGames([]);
      showNotification('게임이 삭제되었습니다.', 'info');
    }
  };

  // 관리자 게임 선택 (대시보드로 이동)
  const handleAdminSelectGame = (game: GameState) => {
    setGameState(game);
    setCurrentGameId(game.id);
    setView('ADMIN_DASHBOARD');
  };

  // 팀 슬롯 선택 (선택만 하고 TeamJoin에서 처리)
  const handleSelectTeamSlot = (teamIndex: number) => {
    setSelectedTeamIndex(teamIndex);
  };

  // 팀 참가 (새 팀 등록 또는 업데이트)
  const handleJoinTeam = (teamData: Partial<Team>, teamIndex: number) => {
    if (!gameState) return;

    const teams = gameState.teams || [];

    // 해당 인덱스에 이미 팀이 있는지 확인
    const existingTeamIndex = teams.findIndex(t => t.index === teamIndex);

    let newTeam: Team;
    let updatedTeams: Team[];

    // 멤버 데이터 깊은 복사 (팀 간 데이터 독립성 보장)
    const membersCopy = (teamData.members || []).map((m: TeamMember) => ({ ...m }));

    if (existingTeamIndex >= 0) {
      // 기존 팀 업데이트 (배열 기본값 보장)
      const existingTeam = teams[existingTeamIndex];
      newTeam = {
        ...existingTeam,
        name: teamData.name || '',
        slogan: teamData.slogan || '',
        members: membersCopy,
        // 배열 속성들 기본값 보장
        sponsorships: existingTeam.sponsorships || [],
        currentRoundPushes: existingTeam.currentRoundPushes || [],
        hasSubmittedPushes: existingTeam.hasSubmittedPushes || false,
        totalPushAllowance: existingTeam.totalPushAllowance || 0,
        totalPoints: existingTeam.totalPoints || 0
      };
      updatedTeams = teams.map((t, i) => i === existingTeamIndex ? newTeam : t);
    } else {
      // 새 팀 생성
      newTeam = {
        id: Math.random().toString(36).substr(2, 9),
        index: teamIndex,
        name: teamData.name || '',
        slogan: teamData.slogan || '',
        members: membersCopy,
        sponsorships: [],
        currentRoundPushes: [],
        hasSubmittedPushes: false,
        totalPushAllowance: 0,
        totalPoints: 0
      };
      updatedTeams = [...teams, newTeam];
    }

    const updatedState = { ...gameState, teams: updatedTeams };
    updateGameState(updatedState);
    setMyTeamId(newTeam.id);
    setView('TEAM_DASHBOARD');

    // 세션 저장
    saveSession({
      gameId: gameState.id,
      teamId: newTeam.id,
      teamIndex: teamIndex,
      view: 'TEAM_DASHBOARD'
    });

    showNotification(`${teamIndex}조 "${newTeam.name}" 팀 참가 완료!`, 'info');
  };

  // 참가자 게임 선택
  const handleSelectGame = (game: GameState) => {
    setGameState(game);
    setCurrentGameId(game.id);
    setSelectedTeamIndex(null); // 팀 선택 초기화
    setView('TEAM_JOIN');
  };

  const currentTeam = gameState?.teams?.find(t => t.id === myTeamId);

  // 라우팅 로직
  const renderContent = () => {
    if (view === 'HOME') {
      return (
        <Lobby
          activeGames={activeGames}
          onAdminClick={() => setView('ADMIN_SETUP')}
          onJoinGame={(game) => {
            handleSelectGame(game);
          }}
          useFirebase={useFirebase}
        />
      );
    }

    if (view === 'ADMIN_SETUP') {
      return (
        <AdminSetup
          onCancel={() => setView('HOME')}
          onCreate={createGame}
          onSelectGame={handleAdminSelectGame}
          onDeleteGame={handleDeleteGame}
          activeGames={activeGames}
        />
      );
    }

    if (view === 'ADMIN_DASHBOARD' || view === 'ADMIN_PREVIEW_USER') {
      if (!gameState) {
        setView('HOME');
        return null;
      }
      return (
        <AdminDashboard
          gameState={gameState}
          updateState={updateGameState}
          onExit={() => {
            setView('HOME');
            setCurrentGameId(null);
          }}
          previewMode={view === 'ADMIN_PREVIEW_USER'}
          onTogglePreview={() => setView(view === 'ADMIN_DASHBOARD' ? 'ADMIN_PREVIEW_USER' : 'ADMIN_DASHBOARD')}
          useFirebase={useFirebase}
        />
      );
    }

    if (view === 'TEAM_JOIN') {
      return (
        <TeamJoin
          gameState={gameState}
          onJoin={handleJoinTeam}
          onBack={() => {
            if (selectedTeamIndex !== null) {
              setSelectedTeamIndex(null);
            } else {
              setView('HOME');
              saveSession(null);
            }
          }}
          selectedTeamIndex={selectedTeamIndex}
          onSelectTeamSlot={handleSelectTeamSlot}
        />
      );
    }

    if (view === 'TEAM_DASHBOARD') {
      if (!gameState || !currentTeam) {
        setView('HOME');
        return null;
      }

      // 안전한 기본값
      const teams = gameState.teams || [];

      // 상태에 따른 화면 분기
      if (gameState.status === 'LOBBY' || gameState.status === 'SPONSORING') {
        return (
          <TeamSponsorship
            team={currentTeam}
            gameState={gameState}
            onUpdate={(update) => updateTeam(currentTeam.id, update)}
          />
        );
      }

      // 미니게임 대기 화면
      if (gameState.status === 'MINI_GAME') {
        return (
          <TeamMiniGameWaiting
            team={currentTeam}
            gameState={gameState}
          />
        );
      }

      return (
        <TeamPushControl
          team={currentTeam}
          gameState={gameState}
          onUpdate={(update) => updateTeam(currentTeam.id, update)}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen relative">
      {/* 동기화 표시 */}
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-blue-600/90 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
          SYNCING
        </div>
      )}

      {/* Firebase 상태 표시 */}
      <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black ${
        useFirebase ? 'bg-green-500 text-white' :
        firebaseStatus === 'permission_denied' ? 'bg-red-500 text-white' :
        'bg-orange-400 text-black'
      }`}>
        <div className={`w-1.5 h-1.5 rounded-full ${
          useFirebase ? 'bg-white' :
          firebaseStatus === 'permission_denied' ? 'bg-white animate-pulse' :
          'bg-black'
        }`}></div>
        {useFirebase ? 'ONLINE' :
         firebaseStatus === 'permission_denied' ? 'PERMISSION ERROR' :
         'OFFLINE'}
      </div>

      {/* Firebase 권한 오류 배너 */}
      {firebaseStatus === 'permission_denied' && firebaseError && (
        <div className="fixed bottom-16 right-4 z-[60] max-w-xs bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-bold text-xs">Firebase 연결 오류</p>
              <p className="text-[10px] mt-1">Firebase Console에서 Realtime Database Rules를 확인하세요.</p>
              <p className="text-[10px] mt-1 text-red-500">현재 오프라인 모드로 실행 중</p>
            </div>
          </div>
        </div>
      )}

      {renderContent()}

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
        />
      )}
    </div>
  );
};

export default App;
