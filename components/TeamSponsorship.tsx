
import React, { useState } from 'react';
import { Team, GameState, Sponsorship } from '../types';
import { RacerCarImage } from '../constants';

interface TeamSponsorshipProps {
  team: Team;
  gameState: GameState;
  onUpdate: (update: Partial<Team>) => void;
}

const TeamSponsorship: React.FC<TeamSponsorshipProps> = ({ team, gameState, onUpdate }) => {
  const [spons, setSpons] = useState<number[]>([1, 2, 3]);
  const [showSponsoredRacers, setShowSponsoredRacers] = useState(false);

  // 안전한 기본값
  const sponsorships = team.sponsorships || [];
  const members = team.members || [];
  const hasSponsorship = sponsorships.length > 0;

  const handleSponsorChange = (idx: number, racerId: number) => {
    const newSpons = [...spons];
    newSpons[idx] = racerId;
    setSpons(newSpons);
  };

  const validate = () => {
    const unique = new Set(spons);
    if (unique.size < 3) {
      alert("한 레이서에게 중복해서 스폰할 수 없습니다. 각각 다른 레이서를 선택해주세요!");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    
    const sponsorships: Sponsorship[] = [
      { racerId: spons[0], amount: 5 },
      { racerId: spons[1], amount: 3 },
      { racerId: spons[2], amount: 2 }
    ];
    onUpdate({ sponsorships });
  };

  // Consistent Mobile Header
  const MobileHeader = () => (
    <div className="w-full bg-black text-white border-b-4 border-black mb-4 flex flex-col p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center border-2 border-white">
            <span className="text-xl font-black text-black">{team.index}조</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-yellow-400 uppercase">{team.name}</span>
            <span className="text-[10px] font-bold text-white/60 italic">"{team.slogan}"</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black bg-yellow-400 text-black px-2 py-0.5 rounded uppercase">Round {gameState.currentRound}</span>
          <span className="text-[8px] font-black text-white/50 mt-1">{gameState.courseName}</span>
        </div>
      </div>

      {/* 스폰한 레이서 보기 버튼 - 스폰십이 있을 때만 표시 */}
      {hasSponsorship && (
        <div className="border-t border-white/20 pt-3">
          <button
            onMouseDown={() => setShowSponsoredRacers(true)}
            onMouseUp={() => setShowSponsoredRacers(false)}
            onMouseLeave={() => setShowSponsoredRacers(false)}
            onTouchStart={() => setShowSponsoredRacers(true)}
            onTouchEnd={() => setShowSponsoredRacers(false)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-black uppercase active:bg-blue-700"
          >
            {showSponsoredRacers ? '👁 스폰한 레이서 보는 중...' : '👁 스폰한 레이서 보기 (누르는 동안)'}
          </button>

          {/* 스폰 레이서 정보 표시 */}
          {showSponsoredRacers && (
            <div className="mt-2 grid grid-cols-3 gap-2 animate-pulse">
              {sponsorships.map((s, i) => (
                <div key={i} className="bg-yellow-400 text-black p-2 rounded-lg text-center border-2 border-white flex flex-col items-center">
                  <RacerCarImage racerId={String(s.racerId)} size={36} />
                  <span className="text-lg font-black">#{s.racerId}</span>
                  <span className="text-[10px] block font-bold">{s.amount}천만</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center min-h-full bg-slate-50 relative">
      <MobileHeader />
      
      <div className="w-full max-w-md px-4 pb-12">
        <div className="flex flex-col items-center mb-10 text-center">
          <p className="text-2xl font-black leading-tight uppercase underline decoration-blue-500 decoration-8">레이서 3인 스폰서십</p>
          <p className="text-xs font-bold text-black/50 mt-4 uppercase">1억원을 분산 스폰하세요 (중복 불가)</p>
        </div>

        {hasSponsorship ? (
          <div className="space-y-6">
            <div className="p-10 brutal-card bg-cyan-400 text-center flex flex-col items-center">
               <span className="text-7xl block mb-6">🏁</span>
               <p className="font-brutal text-2xl uppercase">제출 완료!</p>
               <p className="text-xs font-black mt-4 border-2 border-black p-2 bg-white">강사의 신호를 기다려주세요</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
               {sponsorships.map((s, i) => (
                 <div key={i} className="brutal-card bg-white p-4 text-center flex flex-col items-center">
                    <p className="text-[10px] font-black text-black/40 mb-2 uppercase">{s.amount}천만</p>
                    <RacerCarImage racerId={String(s.racerId)} size={48} />
                    <p className="text-xl font-brutal text-blue-600 italic mt-1">#{s.racerId}</p>
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-4">
              {[5, 3, 2].map((amt, i) => (
                <div key={i} className="brutal-card p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                       <p className="text-[10px] font-black text-black/40 uppercase">Sponsorship Amount</p>
                       <p className="text-3xl font-brutal text-black leading-none">{amt}천만원</p>
                    </div>
                    <span className="text-4xl">💰</span>
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase">Racer Selection</label>
                     <select 
                        className="brutal-input bg-yellow-400 w-full outline-none cursor-pointer text-lg h-14"
                        value={spons[i]}
                        onChange={(e) => handleSponsorChange(i, parseInt(e.target.value))}
                      >
                        {Array.from({ length: 8 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}번 레이서</option>
                        ))}
                      </select>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleSubmit}
              className="brutal-btn w-full py-6 bg-black text-white text-2xl uppercase italic"
            >
              SPONSOR NOW
            </button>
          </div>
        )}

        <div className="mt-12 pt-8 border-t-4 border-black border-dashed">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-brutal text-xl uppercase italic">Team Roster</h3>
              <span className="text-[10px] font-black bg-black text-white px-2 py-1">LOCKED</span>
           </div>
           <div className="grid grid-cols-2 gap-4">
              {members.map((m, i) => (
                <div key={i} className="brutal-card p-3 bg-white">
                   <span className="text-[9px] font-black text-blue-600 uppercase border-b-2 border-black/10 pb-1 mb-1 block">{m.role}</span>
                   <span className="text-sm font-black text-black">{m.name}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSponsorship;
