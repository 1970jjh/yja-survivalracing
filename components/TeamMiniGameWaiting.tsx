
import React, { useState } from 'react';
import { Team, GameState } from '../types';

interface TeamMiniGameWaitingProps {
  team: Team;
  gameState: GameState;
}

const TeamMiniGameWaiting: React.FC<TeamMiniGameWaitingProps> = ({ team, gameState }) => {
  const [showSponsoredRacers, setShowSponsoredRacers] = useState(false);

  // 안전한 기본값
  const sponsorships = team.sponsorships || [];
  const hasSponsorship = sponsorships.length > 0;

  return (
    <div className="flex flex-col items-center min-h-full bg-slate-900 relative">
      {/* Header */}
      <div className="w-full bg-black text-white border-b-4 border-yellow-400 mb-4 flex flex-col p-4 shadow-[4px_4px_0px_0px_rgba(234,179,8,1)]">
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
            <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded uppercase">Round {gameState.currentRound}</span>
            <span className="text-[8px] font-black text-white/50 mt-1">{gameState.courseName}</span>
          </div>
        </div>

        {/* 스폰한 레이서 보기 버튼 */}
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
                  <div key={i} className="bg-yellow-400 text-black p-2 rounded-lg text-center border-2 border-white">
                    <span className="text-2xl font-black">#{s.racerId}</span>
                    <span className="text-[10px] block font-bold">{s.amount}천만</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 대기 화면 내용 */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">🎮</div>
          <h1 className="text-5xl font-black text-orange-500 mb-4 tracking-tight">
            #{gameState.currentRound}R
          </h1>
          <h2 className="text-3xl font-black text-white mb-2">
            MINI GAME
          </h2>
          <p className="text-xl font-bold text-yellow-400 mb-8">대기중...</p>

          <div className="brutal-card bg-white/10 p-6 border-2 border-white/20 max-w-sm mx-auto">
            <p className="text-white/80 text-sm font-bold leading-relaxed">
              오프라인 미니게임에 집중해주세요!<br/>
              <span className="text-yellow-400">순위에 따라 PUSH 권한이 배분</span>됩니다.
            </p>
          </div>

          <div className="mt-8 flex justify-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamMiniGameWaiting;
