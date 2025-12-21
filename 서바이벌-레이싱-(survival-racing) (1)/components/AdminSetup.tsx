
import React, { useState } from 'react';
import { ADMIN_PASSWORD } from '../constants';

interface AdminSetupProps {
  onCancel: () => void;
  onCreate: (courseName: string, teamCount: number, rounds: number) => void;
}

const AdminSetup: React.FC<AdminSetupProps> = ({ onCancel, onCreate }) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [rounds, setRounds] = useState(3);

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsUnlocked(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
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

          <button 
            onClick={() => onCreate(courseName || '무제 과정', teamCount, rounds)}
            className="w-full py-4 bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
          >
            <span>🏁</span> CREATE GAME
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-300">@ All Right Reserved by JJ Creative 교육연구소</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
