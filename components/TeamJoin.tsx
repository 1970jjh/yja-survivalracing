
import React, { useState } from 'react';
import { GameState, UserRole, TeamMember } from '../types';

interface TeamJoinProps {
  gameState: GameState | null;
  onJoin: (data: any) => void;
  onBack: () => void;
}

const TeamJoin: React.FC<TeamJoinProps> = ({ gameState, onJoin, onBack }) => {
  const [teamName, setTeamName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [members, setMembers] = useState<TeamMember[]>(
    Object.values(UserRole).map(role => ({ name: '', role }))
  );

  const handleMemberChange = (index: number, name: string) => {
    const newMembers = [...members];
    newMembers[index].name = name;
    setMembers(newMembers);
  };

  const isFormValid = teamName && slogan && members.every(m => m.name.trim() !== '');

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl overflow-y-auto">
        <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 뒤로가기</button>
        
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">팀 레이싱 편성</h1>
          <p className="text-xs text-slate-400">Racing Team Building</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">1) 팀 명 정하기</label>
            <input 
              placeholder="멋진 팀명을 지어주세요"
              className="w-full border-slate-200 border p-3 rounded-xl"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">2) 팀 구호</label>
            <input 
              placeholder="팀의 에너지를 보여줄 구호"
              className="w-full border-slate-200 border p-3 rounded-xl"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">3) 역할 정하기</label>
            <div className="space-y-3">
              {members.map((member, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-center">
                    {member.role}
                  </div>
                  <input 
                    placeholder="이름 입력"
                    className="flex-1 border-slate-200 border p-2 rounded-lg text-sm"
                    value={member.name}
                    onChange={(e) => handleMemberChange(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={() => onJoin({ name: teamName, slogan, members })}
            disabled={!isFormValid}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${isFormValid ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          >
            JOIN RACE
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamJoin;
