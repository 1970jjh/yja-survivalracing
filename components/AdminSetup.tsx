
import React, { useState } from 'react';
import { ADMIN_PASSWORD } from '../constants';
import { GameState } from '../types';

interface AdminSetupProps {
  onCancel: () => void;
  onCreate: (courseName: string, teamCount: number, rounds: number) => void;
  onSelectGame: (game: GameState) => void;
  onDeleteGame: (gameId: string) => void;
  activeGames: GameState[];
}

const AdminSetup: React.FC<AdminSetupProps> = ({ onCancel, onCreate, onSelectGame, onDeleteGame, activeGames }) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [mode, setMode] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [courseName, setCourseName] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [rounds, setRounds] = useState(3);

  // 안전한 기본값
  const games = activeGames || [];

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsUnlocked(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleDeleteGame = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 게임을 삭제하시겠습니까?')) {
      onDeleteGame(gameId);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-center">관리자 모드 진입</h2>
          <input
            type="password"
            placeholder="비밀번호를 입력하세요"
            className="w-full border p-3 rounded-xl mb-4 text-center text-2xl tracking-widest"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold"
            >
              취소
            </button>
            <button
              onClick={handleUnlock}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 기존 게임 선택 화면
  if (mode === 'SELECT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <h1 className="text-2xl font-black text-slate-800">관리자 대시보드</h1>
            <p className="text-xs text-slate-400">게임을 선택하거나 새로 만드세요</p>
          </div>

          {/* 기존 게임 목록 */}
          <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
            {games.length > 0 ? (
              games.map(game => {
                const teams = game.teams || [];
                return (
                  <div
                    key={game.id}
                    onClick={() => onSelectGame(game)}
                    className="border-2 border-black rounded-xl p-4 bg-white hover:bg-yellow-50 cursor-pointer transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-lg">{game.courseName}</h3>
                        <p className="text-xs text-slate-400">
                          {teams.length}/{game.maxTeams} 팀 • Round {game.currentRound}/{game.totalRounds}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        game.status === 'LOBBY' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDeleteGame(game.id, e)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <span className="text-3xl block mb-2">📭</span>
                <p className="text-sm text-slate-400">생성된 게임이 없습니다</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold"
            >
              뒤로가기
            </button>
            <button
              onClick={() => setMode('CREATE')}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold"
            >
              + 새 게임 만들기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 새 게임 만들기 화면
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
         <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
             <div className="w-10 h-10 border-4 border-blue-500 rounded-lg"></div>
          </div>
          <h2 className="text-sm text-slate-400 font-bold mb-1">JJ CREATIVE 교육연구소</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">게임 생성</h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Company / Course Name</label>
            <input
              type="text"
              placeholder="예) 삼성전자 팀빌딩"
              className="w-full border-slate-200 border p-3 rounded-xl"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Team Count (2~30)</label>
            <select
              className="w-full border-slate-200 border p-3 rounded-xl bg-white"
              value={teamCount}
              onChange={(e) => setTeamCount(parseInt(e.target.value))}
            >
              {Array.from({ length: 29 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n}개 팀</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Rounds (3~10)</label>
            <select
              className="w-full border-slate-200 border p-3 rounded-xl bg-white"
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value))}
            >
              {Array.from({ length: 8 }, (_, i) => i + 3).map(n => (
                <option key={n} value={n}>{n} 라운드</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('SELECT')}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold"
            >
              뒤로
            </button>
            <button
              onClick={() => onCreate(courseName || '무제 과정', teamCount, rounds)}
              className="flex-1 py-4 bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
            >
              <span>🏁</span> CREATE
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-300">@ All Right Reserved by JJ Creative 교육연구소</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
