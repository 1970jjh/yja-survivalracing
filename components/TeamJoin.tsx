
import React, { useState } from 'react';
import { GameState, UserRole, TeamMember, Team } from '../types';

interface TeamJoinProps {
  gameState: GameState | null;
  onJoin: (data: any, teamIndex: number) => void;
  onBack: () => void;
  selectedTeamIndex?: number | null;
  onSelectTeamSlot: (index: number) => void;
}

const TeamJoin: React.FC<TeamJoinProps> = ({ gameState, onJoin, onBack, selectedTeamIndex, onSelectTeamSlot }) => {
  const [teamName, setTeamName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [members, setMembers] = useState<TeamMember[]>(
    Object.values(UserRole).map(role => ({ name: '', role }))
  );

  const teams = gameState?.teams || [];
  const maxTeams = gameState?.maxTeams || 2;

  // 팀 슬롯이 이미 사용 중인지 확인
  const isSlotTaken = (index: number) => {
    return teams.some((t: Team) => t.index === index && t.name && t.name.trim() !== '');
  };

  // 해당 슬롯의 팀 정보 가져오기
  const getTeamAtSlot = (index: number) => {
    return teams.find((t: Team) => t.index === index);
  };

  const handleMemberChange = (index: number, name: string) => {
    const newMembers = [...members];
    newMembers[index].name = name;
    setMembers(newMembers);
  };

  const isFormValid = teamName && slogan && members.every(m => m.name.trim() !== '');

  // 팀 슬롯 선택 화면
  if (selectedTeamIndex === null || selectedTeamIndex === undefined) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
          <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 뒤로가기</button>

          <div className="flex flex-col items-center mb-6">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">팀 선택</h1>
            <p className="text-xs text-slate-400">{gameState?.courseName || '게임'}</p>
          </div>

          <p className="text-sm text-center text-slate-500 mb-6">
            참여할 팀 번호를 선택하세요
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6 max-h-[400px] overflow-y-auto">
            {Array.from({ length: maxTeams }, (_, i) => {
              const teamIndex = i + 1;
              const taken = isSlotTaken(teamIndex);
              const existingTeam = getTeamAtSlot(teamIndex);

              return (
                <button
                  key={teamIndex}
                  onClick={() => onSelectTeamSlot(teamIndex)}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${
                    taken
                      ? 'border-green-400 bg-green-50 text-green-600'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-2xl font-black">{teamIndex}조</div>
                  {taken && existingTeam ? (
                    <div className="text-[10px] mt-1 truncate">{existingTeam.name}</div>
                  ) : (
                    <div className="text-[10px] mt-1 text-slate-400">빈 자리</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 팀 정보 입력 화면
  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl overflow-y-auto">
        <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 팀 선택으로</button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mb-2 border-4 border-black">
            <span className="text-2xl font-black">{selectedTeamIndex}조</span>
          </div>
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
            onClick={() => onJoin({ name: teamName, slogan, members }, selectedTeamIndex)}
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
