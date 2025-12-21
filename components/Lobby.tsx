import React from 'react';
import { GameState } from '../types';

interface LobbyProps {
  activeGames: GameState[];
  onAdminClick: () => void;
  onJoinGame: () => void;
  useFirebase?: boolean;
}

const Lobby: React.FC<LobbyProps> = ({ activeGames, onAdminClick, onJoinGame, useFirebase }) => {
  // 게임 상태에 따른 표시 텍스트
  const getStatusText = (status: GameState['status']) => {
    switch (status) {
      case 'LOBBY': return '대기중';
      case 'SPONSORING': return '스폰서십';
      case 'MINI_GAME': return '미니게임';
      case 'PUSH_INPUT': return 'PUSH 입력';
      case 'REVEALING': return '결과 공개';
      case 'RESULTS': return '최종 결과';
      case 'FINISHED': return '종료';
      default: return '진행중';
    }
  };

  const getStatusColor = (status: GameState['status']) => {
    switch (status) {
      case 'LOBBY': return 'bg-blue-100 text-blue-600';
      case 'SPONSORING': return 'bg-purple-100 text-purple-600';
      case 'MINI_GAME': return 'bg-orange-100 text-orange-600';
      case 'PUSH_INPUT': return 'bg-green-100 text-green-600';
      case 'REVEALING': return 'bg-pink-100 text-pink-600';
      case 'RESULTS': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-3xl">🏎️</span>
          </div>
          <h2 className="text-sm text-slate-400 font-bold mb-1">JJ CREATIVE 교육연구소</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
            AI Survival <span className="text-blue-600">Racing</span>
          </h1>
          <p className="text-xs text-slate-400 tracking-widest mt-1">COLLECTIVE INTELLIGENCE CHALLENGE</p>
        </div>

        <div className="flex gap-4 mb-10">
          <button
            onClick={onJoinGame}
            disabled={activeGames.length === 0}
            className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
              activeGames.length > 0
                ? 'border-purple-400 text-purple-600 hover:bg-purple-50'
                : 'border-slate-200 text-slate-300 cursor-not-allowed'
            }`}
          >
            게임 참여
          </button>
          <button
            onClick={onAdminClick}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all"
          >
            게임 생성
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Active Games</h3>
            <div className="flex items-center gap-2">
              {useFirebase !== undefined && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                  useFirebase ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {useFirebase ? '🌐 ONLINE' : '💻 LOCAL'}
                </span>
              )}
            </div>
          </div>

          {activeGames.length > 0 ? (
            activeGames.map(game => (
              <div
                key={game.id}
                className="border-2 border-black rounded-2xl p-5 bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-black text-lg text-slate-800">{game.courseName}</h4>
                    <p className="text-xs text-slate-400">
                      {game.teams.length}/{game.maxTeams} Teams • Round {game.currentRound}/{game.totalRounds}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getStatusColor(game.status)}`}>
                    {getStatusText(game.status)}
                  </span>
                </div>

                {/* 참가 팀 미리보기 */}
                {game.teams.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {game.teams.slice(0, 5).map(team => (
                      <span key={team.id} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold">
                        {team.name}
                      </span>
                    ))}
                    {game.teams.length > 5 && (
                      <span className="text-[10px] text-slate-400">+{game.teams.length - 5}팀</span>
                    )}
                  </div>
                )}

                <button
                  onClick={onJoinGame}
                  className="w-full py-3 bg-yellow-400 text-black rounded-lg font-black text-sm hover:bg-yellow-300 transition-all border-2 border-black"
                >
                  🚀 입장하기
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
              <span className="text-4xl block mb-4">🏁</span>
              <p className="text-sm text-slate-400 font-bold">현재 활성화된 게임이 없습니다.</p>
              <p className="text-xs text-slate-300 mt-2">관리자가 게임을 생성하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-slate-300">© All Rights Reserved by JJ Creative 교육연구소</p>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
