
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, Team, Racer, UserRole, Sponsorship, PushDecision } from './types';
import { ADMIN_PASSWORD, RACER_COLORS } from './constants';
import Lobby from './components/Lobby';
import AdminSetup from './components/AdminSetup';
import AdminDashboard from './components/AdminDashboard';
import TeamJoin from './components/TeamJoin';
import TeamSponsorship from './components/TeamSponsorship';
import TeamPushControl from './components/TeamPushControl';
import Notification from './components/Notification';

// Real-time Sync Channel
const SYNC_CHANNEL = new BroadcastChannel('survival_racing_sync');

const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'ADMIN_SETUP' | 'ADMIN_DASHBOARD' | 'TEAM_JOIN' | 'TEAM_DASHBOARD' | 'ADMIN_PREVIEW_USER'>('HOME');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'info' | 'error'} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Persistence and Real-time Sync listener
  useEffect(() => {
    const saved = localStorage.getItem('survival_racing_state');
    if (saved) {
      setGameState(JSON.parse(saved));
    }

    const handleSync = (event: MessageEvent) => {
      const newState = event.data as GameState | null;
      setGameState(newState);
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 500);
    };

    SYNC_CHANNEL.onmessage = handleSync;
    
    // Also listen to storage events (for other tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === 'survival_racing_state') {
        setGameState(e.newValue ? JSON.parse(e.newValue) : null);
      }
    });

    return () => {
      SYNC_CHANNEL.onmessage = null;
    };
  }, []);

  const updateGameState = useCallback((newState: GameState | null, broadcast = true) => {
    setGameState(newState);
    if (newState) {
      localStorage.setItem('survival_racing_state', JSON.stringify(newState));
      if (broadcast) {
        SYNC_CHANNEL.postMessage(newState);
      }
    } else {
      localStorage.removeItem('survival_racing_state');
      if (broadcast) {
        SYNC_CHANNEL.postMessage(null);
      }
    }
  }, []);

  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const createGame = (courseName: string, teamCount: number, rounds: number) => {
    const initialState: GameState = {
      id: Math.random().toString(36).substr(2, 9),
      courseName,
      maxTeams: teamCount,
      totalRounds: rounds,
      currentRound: 1,
      status: 'LOBBY',
      timer: 0,
      racers: Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        color: RACER_COLORS[i],
        position: 0,
        isEliminated: false
      })),
      teams: [],
      adminTotalPush: 47
    };
    updateGameState(initialState);
    setView('ADMIN_DASHBOARD');
  };

  const handleJoinTeam = (teamData: Partial<Team>) => {
    if (!gameState) return;
    
    // Check if team already exists by name (for reconnecting)
    const existingTeam = gameState.teams.find(t => t.name === teamData.name);
    if (existingTeam) {
      setMyTeamId(existingTeam.id);
      setView('TEAM_DASHBOARD');
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
    setView('TEAM_DASHBOARD');
  };

  const currentTeam = gameState?.teams.find(t => t.id === myTeamId);

  // Router logic
  const renderContent = () => {
    if (view === 'HOME') {
      return (
        <Lobby 
          activeGames={gameState ? [gameState] : []} 
          onAdminClick={() => setView('ADMIN_SETUP')}
          onJoinGame={() => setView('TEAM_JOIN')}
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
      if (!gameState) return setView('HOME');
      return (
        <AdminDashboard 
          gameState={gameState} 
          updateState={updateGameState}
          onExit={() => setView('HOME')}
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
      if (!gameState || !currentTeam) return setView('HOME');

      if (gameState.status === 'LOBBY' || gameState.status === 'SPONSORING') {
        return (
          <TeamSponsorship 
            team={currentTeam}
            gameState={gameState}
            onUpdate={(update) => {
              const newTeams = gameState.teams.map(t => t.id === currentTeam.id ? { ...t, ...update } : t);
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
            const newTeams = gameState.teams.map(t => t.id === currentTeam.id ? { ...t, ...update } : t);
            updateGameState({ ...gameState, teams: newTeams });
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen relative">
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-blue-600/90 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
          SYNCING
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
