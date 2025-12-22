
import React, { useState, useEffect } from 'react';
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
  const gameStatus = gameState?.status || 'LOBBY';
  const isGameInProgress = gameStatus !== 'LOBBY' && gameStatus !== 'SPONSORING';

  // 게임 상태에 따른 배너 메시지
  const getStatusBanner = () => {
    switch (gameStatus) {
      case 'MINI_GAME':
        return { text: '🎮 미니게임 진행 중! 빨리 입장하세요!', color: 'bg-orange-500' };
      case 'PUSH_INPUT':
        return { text: '⚡ PUSH 입력 중! 빨리 입장하세요!', color: 'bg-green-500' };
      case 'REVEALING':
        return { text: '🎯 결과 공개 중!', color: 'bg-pink-500' };
      default:
        return null;
    }
  };

  const statusBanner = getStatusBanner();

  // 해당 슬롯의 팀 정보 가져오기
  const getTeamAtSlot = (index: number) => {
    return teams.find((t: Team) => t.index === index);
  };

  // 팀 정보가 완성되었는지 확인
  const isTeamComplete = (team: Team | undefined) => {
    if (!team) return false;
    return team.name && team.name.trim() !== '' &&
           team.slogan && team.slogan.trim() !== '' &&
           team.members && team.members.length > 0 &&
           team.members.every(m => m.name && m.name.trim() !== '');
  };

  // 선택된 팀의 정보로 폼 초기화 (팀 변경 시 항상 해당 팀 데이터로 리셋)
  useEffect(() => {
    if (selectedTeamIndex) {
      const existingTeam = getTeamAtSlot(selectedTeamIndex);
      if (existingTeam && isTeamComplete(existingTeam)) {
        // 완성된 팀의 데이터로 설정
        setTeamName(existingTeam.name || '');
        setSlogan(existingTeam.slogan || '');
        if (existingTeam.members && existingTeam.members.length > 0) {
          // 깊은 복사로 독립적인 배열 생성
          setMembers(existingTeam.members.map(m => ({ ...m })));
        }
      } else {
        // 미완성 팀이면 폼 초기화
        setTeamName('');
        setSlogan('');
        setMembers(Object.values(UserRole).map(role => ({ name: '', role })));
      }
    } else {
      // 팀 선택 해제 시 폼 초기화
      setTeamName('');
      setSlogan('');
      setMembers(Object.values(UserRole).map(role => ({ name: '', role })));
    }
  }, [selectedTeamIndex, teams]);

  const handleMemberChange = (index: number, name: string) => {
    // 깊은 복사로 독립적인 배열 생성
    const newMembers = members.map((m, i) =>
      i === index ? { ...m, name } : { ...m }
    );
    setMembers(newMembers);
  };

  const isFormValid = teamName.trim() !== '' && slogan.trim() !== '' && members.every(m => m.name.trim() !== '');

  // 팀 슬롯 선택 화면
  if (selectedTeamIndex === null || selectedTeamIndex === undefined) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
        {/* 게임 진행 상태 배너 */}
        {statusBanner && (
          <div className={`w-full max-w-md ${statusBanner.color} text-white p-3 rounded-t-3xl text-center font-black text-sm animate-pulse`}>
            {statusBanner.text}
          </div>
        )}
        <div className={`bg-white ${statusBanner ? 'rounded-b-3xl' : 'rounded-3xl'} p-8 w-full max-w-md text-slate-900 shadow-2xl`}>
          <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 뒤로가기</button>

          <div className="flex flex-col items-center mb-6">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">팀 선택</h1>
            <p className="text-xs text-slate-400">{gameState?.courseName || '게임'}</p>
          </div>

          <p className="text-sm text-center text-slate-500 mb-6">
            본인의 팀 번호를 선택하세요
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6 max-h-[400px] overflow-y-auto">
            {Array.from({ length: maxTeams }, (_, i) => {
              const teamIndex = i + 1;
              const existingTeam = getTeamAtSlot(teamIndex);
              const isComplete = isTeamComplete(existingTeam);

              return (
                <button
                  key={teamIndex}
                  onClick={() => onSelectTeamSlot(teamIndex)}
                  className={`p-4 rounded-xl border-2 font-bold transition-all ${
                    isComplete
                      ? 'border-green-400 bg-green-50 text-green-600'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-2xl font-black">{teamIndex}조</div>
                  {isComplete && existingTeam ? (
                    <div className="text-[10px] mt-1 truncate">{existingTeam.name}</div>
                  ) : (
                    <div className="text-[10px] mt-1 text-orange-500">미등록</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 선택된 팀 정보
  const selectedTeam = getTeamAtSlot(selectedTeamIndex);
  const isSelectedTeamComplete = isTeamComplete(selectedTeam);

  // 팀 정보가 이미 완성된 경우 - 바로 입장 화면
  if (isSelectedTeamComplete && selectedTeam) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
        {/* 게임 진행 상태 배너 */}
        {statusBanner && (
          <div className={`w-full max-w-md ${statusBanner.color} text-white p-3 rounded-t-3xl text-center font-black text-sm animate-pulse`}>
            {statusBanner.text}
          </div>
        )}
        <div className={`bg-white ${statusBanner ? 'rounded-b-3xl' : 'rounded-3xl'} p-8 w-full max-w-md text-slate-900 shadow-2xl`}>
          <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 팀 선택으로</button>

          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-green-400 rounded-full flex items-center justify-center mb-3 border-4 border-black">
              <span className="text-3xl font-black">{selectedTeamIndex}조</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800">{selectedTeam.name}</h1>
            <p className="text-sm text-slate-500 italic">"{selectedTeam.slogan}"</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">팀 멤버</h3>
            <div className="grid grid-cols-2 gap-2">
              {selectedTeam.members?.map((m, i) => (
                <div key={i} className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-blue-600 font-bold block">{m.role}</span>
                  <span className="text-sm font-bold">{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onJoin({
              name: selectedTeam.name,
              slogan: selectedTeam.slogan,
              members: selectedTeam.members
            }, selectedTeamIndex)}
            className="w-full py-4 rounded-xl font-bold bg-green-500 text-white shadow-lg hover:bg-green-600 transition-all"
          >
            🚀 {selectedTeamIndex}조로 입장하기
          </button>
        </div>
      </div>
    );
  }

  // 팀 정보 입력 화면 (첫 번째 사람이 입력)
  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-900 p-4 pb-10">
      {/* 게임 진행 상태 배너 */}
      {statusBanner && (
        <div className={`w-full max-w-md ${statusBanner.color} text-white p-3 rounded-t-3xl text-center font-black text-sm animate-pulse`}>
          {statusBanner.text}
        </div>
      )}
      <div className={`bg-white ${statusBanner ? 'rounded-b-3xl' : 'rounded-3xl'} p-8 w-full max-w-md text-slate-900 shadow-2xl overflow-y-auto`}>
        <button onClick={onBack} className="text-slate-400 mb-4 font-bold">← 팀 선택으로</button>

        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mb-2 border-4 border-black">
            <span className="text-2xl font-black">{selectedTeamIndex}조</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">팀 레이싱 편성</h1>
          <p className="text-xs text-slate-400">Racing Team Building</p>
        </div>

        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 mb-6">
          <p className="text-xs text-orange-700 font-bold text-center">
            ⚠️ 아직 {selectedTeamIndex}조의 팀 정보가 등록되지 않았습니다.<br/>
            팀원 중 한 명이 아래 정보를 입력해주세요.
          </p>
        </div>

        <div className="space-y-5">
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
            <div className="space-y-2">
              {members.map((member, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-20 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-center">
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
            onClick={() => {
              if (!isFormValid) {
                setTimeout(() => alert('팀명, 구호, 모든 역할의 이름을 입력해주세요.'), 50);
                return;
              }
              onJoin({ name: teamName, slogan, members }, selectedTeamIndex);
            }}
            disabled={!isFormValid}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
              isFormValid
                ? 'bg-blue-600 text-white shadow-blue-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            팀 등록 및 입장
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamJoin;
