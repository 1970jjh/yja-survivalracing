import React, { useState, useEffect, useCallback } from 'react';
import { GameState, Team, TimerState, RevealState } from './types';
import { RACER_COLORS } from './constants';
import { saveGameState, subscribeToActiveGames, isFirebaseConfigured } from './firebase';
import Lobby from './components/Lobby';
import AdminSetup from './components/AdminSetup';
import AdminDashboard from './components/AdminDashboard';
import TeamJoin from './components/TeamJoin';
import TeamSponsorship from './components/TeamSponsorship';
import TeamPushControl from './components/TeamPushControl';
import Notification from './components/Notification';

// 로컬 동기화용 BroadcastChannel (같은 브라우저 탭 간)
const SYNC_CHANNEL = new BroadcastChannel('survival_racing_sync');

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'ADMIN_SETUP' | 'ADMIN_DASHBOARD' | 'TEAM_JOIN' | 'TEAM_DASHBOARD' | 'ADMIN_PREVIEW_USER'>('HOME');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeGames, setActiveGames] = useState<GameState[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'error'} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useFirebase, setUseFirebase] = useState(false);

  // Firebase 설정 확인
  useEffect(() => {
    const configured = isFirebaseConfigured();
    setUseFirebase(configured);
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
    setActiveGames([updatedState]);

    if (useFirebase) {
      try {
        await saveGameState(updatedState);
      } catch (error) {
        console.error('Firebase 저장 실패:', error);
        showNotification('동기화 실패. 오프라인 모드로 전환합니다.', 'error');
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
      adminTotalPush: 47,
      revealState: initialReveal,
      createdAt: now,
      updatedAt: now
    };

    updateGameState(initialState);
    setCurrentGameId(initialState.id);
    setView('ADMIN_DASHBOARD');
    showNotification(`"${courseName}" 게임이 생성되었습니다!`, 'info');
  };

  // 팀 참가
  const handleJoinTeam = (teamData: Partial<Team>) => {
    if (!gameState) return;

    // 이미 존재하는 팀인지 확인 (재접속용)
    const existingTeam = gameState.teams.find(t => t.name === teamData.name);
    if (existingTeam) {
      setMyTeamId(existingTeam.id);
      setCurrentGameId(gameState.id);
      setView('TEAM_DASHBOARD');
      showNotification(`"${existingTeam.name}" 팀으로 재접속했습니다!`, 'info');
      return;
    }

    // 팀 수 제한 확인
    if (gameState.teams.length >= gameState.maxTeams) {
      showNotification('최대 팀 수에 도달했습니다.', 'error');
      return;
    }

    const newTeam: Team = {
      id: Math.random().toString(36).substr(2, 9),
      index: gameState.teams.length + 1,
      name: teamData.name || '',
      slogan: teamData.slogan || '',
      members: teamData.members || [],
      sponsorships: [],
      currentRoundPushes: [],
      hasSubmittedPushes: false,
      totalPushAllowance: 0,
      totalPoints: 0
    };

    const updatedState = { ...gameState, teams: [...gameState.teams, newTeam] };
    updateGameState(updatedState);
    setMyTeamId(newTeam.id);
    setCurrentGameId(gameState.id);
    setView('TEAM_DASHBOARD');
    showNotification(`"${newTeam.name}" 팀 참가 완료!`, 'info');
  };

  // 게임 선택
  const handleSelectGame = (game: GameState) => {
    setGameState(game);
    setCurrentGameId(game.id);
    setView('TEAM_JOIN');
  };

  const currentTeam = gameState?.teams.find(t => t.id === myTeamId);

  // 라우팅 로직
  const renderContent = () => {
    if (view === 'HOME') {
      return (
        <Lobby
          activeGames={activeGames}
          onAdminClick={() => setView('ADMIN_SETUP')}
          onJoinGame={() => {
            if (activeGames.length === 1) {
              handleSelectGame(activeGames[0]);
            } else if (activeGames.length > 1) {
              handleSelectGame(activeGames[0]);
            } else {
              showNotification('참여할 수 있는 게임이 없습니다.', 'error');
            }
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
        />
      );
    }

    if (view === 'TEAM_JOIN') {
      return (
        <TeamJoin
          gameState={gameState}
          onJoin={handleJoinTeam}
          onBack={() => setView('HOME')}
        />
      );
    }

    if (view === 'TEAM_DASHBOARD') {
      if (!gameState || !currentTeam) {
        setView('HOME');
        return null;
      }

      // 상태에 따른 화면 분기
      if (gameState.status === 'LOBBY' || gameState.status === 'SPONSORING') {
        return (
          <TeamSponsorship
            team={currentTeam}
            gameState={gameState}
            onUpdate={(update) => {
              const newTeams = gameState.teams.map(t =>
                t.id === currentTeam.id ? { ...t, ...update } : t
              );
              updateGameState({ ...gameState, teams: newTeams });
            }}
          />
        );
      }

      return (
        <TeamPushControl
          team={currentTeam}
          gameState={gameState}
          onUpdate={(update) => {
            const newTeams = gameState.teams.map(t =>
              t.id === currentTeam.id ? { ...t, ...update } : t
            );
            updateGameState({ ...gameState, teams: newTeams });
          }}
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
      <div className={`fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black ${useFirebase ? 'bg-green-500 text-white' : 'bg-orange-400 text-black'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${useFirebase ? 'bg-white' : 'bg-black'}`}></div>
        {useFirebase ? 'ONLINE' : 'OFFLINE'}
      </div>

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
