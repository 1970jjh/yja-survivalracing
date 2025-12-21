
import React from 'react';
import { GameState } from '../types';

interface LobbyProps {
  activeGames: GameState[];
  onAdminClick: () => void;
  onJoinGame: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ activeGames, onAdminClick, onJoinGame }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
             <div className="w-10 h-10 border-4 border-blue-500 rounded-lg"></div>
          </div>
          <h2 className="text-sm text-slate-400 font-bold mb-1">JJ CREATIVE 교육연구소</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">AI Survival <span className="text-blue-600">Racing</span></h1>
          <p className="text-xs text-slate-400 tracking-widest mt-1">COLLECTIVE INTELLIGENCE CHALLENGE</p>
        </div>

        <div className="flex gap-4 mb-10">
          <button 
            onClick={onJoinGame}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-purple-200 text-purple-600 font-bold hover:bg-purple-50 transition-all"
          >
            게임 참여
          </button>
          <button 
            onClick={onAdminClick}
            className="flex-1 py-3 px-4 rounded-xl text-slate-400 font-bold hover:bg-slate-50 transition-all"
          >
            게임 생성
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-700">Active Games</h3>
            <button className="text-xs text-blue-500 flex items-center gap-1">
              <span>↻</span> Refresh
            </button>
          </div>

          {activeGames.length > 0 ? (
            activeGames.map(game => (
              <div key={game.id} className="border border-slate-100 rounded-2xl p-5 bg-white hover:border-blue-100 transition-all shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-black text-lg text-slate-800">{game.courseName}</h4>
                    <p className="text-xs text-slate-400">
                      {game.teams.length}/{game.maxTeams} Teams • {game.totalRounds} Rounds
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    Playing
                  </span>
                </div>
                <button 
                  onClick={onJoinGame}
                  className="w-full py-2.5 bg-cyan-50 text-cyan-700 rounded-lg font-bold text-sm hover:bg-cyan-100 transition-all"
                >
                  ENTER ROOM
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-sm text-slate-400">현재 활성화된 게임이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-slate-300">@ All Right Reserved by JJ Creative 교육연구소</p>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
