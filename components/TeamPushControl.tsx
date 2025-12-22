
import React, { useState, useEffect, useRef } from 'react';
import { Team, GameState, PushDecision } from '../types';

interface TeamPushControlProps {
  team: Team;
  gameState: GameState;
  onUpdate: (update: Partial<Team>) => void;
}

const TeamPushControl: React.FC<TeamPushControlProps> = ({ team, gameState, onUpdate }) => {
  // 현재 라운드 추적 (새 라운드 시작 시 리셋 감지용)
  const currentRoundRef = useRef(gameState.currentRound);

  // 로컬 제출 상태 (즉각적인 UI 반응용)
  const [isSubmittedLocally, setIsSubmittedLocally] = useState(team.hasSubmittedPushes || false);

  // 제출된 PUSH 데이터 (제출 완료 화면에 표시용)
  const [submittedPushes, setSubmittedPushes] = useState<PushDecision[]>(team.currentRoundPushes || []);

  // 입력 중인 PUSH 값들 (로컬 상태)
  const [pushes, setPushes] = useState<number[]>(() => {
    const initial = new Array(8).fill(0);
    const currentPushes = team.currentRoundPushes || [];
    currentPushes.forEach(p => {
      if (p.racerId >= 1 && p.racerId <= 8) {
        initial[p.racerId - 1] = p.count;
      }
    });
    return initial;
  });

  const [showSponsoredRacers, setShowSponsoredRacers] = useState(false);

  // 안전한 기본값
  const racers = gameState.racers || [];
  const sponsorships = team.sponsorships || [];

  // 새 라운드 시작 시 상태 리셋
  useEffect(() => {
    if (gameState.currentRound !== currentRoundRef.current) {
      // 새 라운드 시작됨 - 모든 상태 리셋
      currentRoundRef.current = gameState.currentRound;
      setIsSubmittedLocally(false);
      setSubmittedPushes([]);
      setPushes(new Array(8).fill(0));
    }
  }, [gameState.currentRound]);

  // Firebase에서 제출 완료 상태 동기화 (다른 기기에서 제출한 경우)
  useEffect(() => {
    if (team.hasSubmittedPushes && !isSubmittedLocally) {
      // Firebase에서 제출 완료됨 - 로컬 상태 동기화
      setIsSubmittedLocally(true);
      setSubmittedPushes(team.currentRoundPushes || []);
    }
  }, [team.hasSubmittedPushes, team.currentRoundPushes]);

  const totalUsed = pushes.reduce((a, b) => a + Math.abs(b), 0);
  const remaining = team.totalPushAllowance - totalUsed;

  // 로컬 상태만 변경 (Firebase에 저장하지 않음)
  const handlePushChange = (racerIdx: number, val: number) => {
    // 이미 제출한 경우 수정 불가
    if (isSubmittedLocally) return;

    const clamped = Math.max(-20, Math.min(20, val));
    const newPushes = [...pushes];
    newPushes[racerIdx] = clamped;
    setPushes(newPushes);
  };

  const validatePushes = (): string | null => {
    if (totalUsed !== team.totalPushAllowance) return "모든 PUSH 칸수를 정확히 사용해야 합니다.";
    const activeRacers = pushes.filter(p => p !== 0).length;
    // PUSH가 4개 이하이면 최소 2명, 그 외에는 최소 3명의 레이서에게 배분
    const minRacers = team.totalPushAllowance <= 4 ? 2 : 3;
    if (activeRacers < minRacers) return `최소 ${minRacers}명의 레이서에게 배분해야 합니다.`;
    const maxAllowedPerRacer = Math.floor(team.totalPushAllowance * 0.7);
    if (pushes.some(p => Math.abs(p) > maxAllowedPerRacer)) {
      return `한 레이서에게 과도한 배정은 금지됩니다 (최대 ${maxAllowedPerRacer}칸).`;
    }
    return null;
  };

  // 제출 시 로컬 상태 먼저 업데이트 후 Firebase에 저장
  const handleSubmit = () => {
    const error = validatePushes();
    if (error) return alert(error);

    // PUSH 결정 데이터 생성
    const decisions: PushDecision[] = pushes
      .map((p, i) => ({ racerId: i + 1, count: p }))
      .filter(p => p.count !== 0);

    // 로컬 상태 먼저 업데이트 (즉각적인 UI 반응)
    setIsSubmittedLocally(true);
    setSubmittedPushes(decisions);

    // Firebase에 저장
    onUpdate({
      currentRoundPushes: decisions,
      hasSubmittedPushes: true
    });
  };

  // Header Component for Mobile UI
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

      {/* 스폰한 레이서 보기 버튼 */}
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
        {showSponsoredRacers && sponsorships.length > 0 && (
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
    </div>
  );

  // 제출 완료 화면 (로컬 제출 상태 또는 Firebase 제출 상태)
  if (isSubmittedLocally || team.hasSubmittedPushes) {
    // 표시할 PUSH 데이터 (로컬 우선, 없으면 Firebase에서)
    const displayPushes = submittedPushes.length > 0 ? submittedPushes : (team.currentRoundPushes || []);

    return (
      <div className="flex flex-col items-center min-h-full bg-slate-50">
        <MobileHeader />
        <div className="w-full max-w-md px-4 pb-10">
          <div className="p-12 brutal-card bg-lime-400 text-center mb-8">
            <span className="text-8xl block mb-8">🚀</span>
            <h1 className="text-5xl font-brutal uppercase italic leading-none mb-4">SUBMITTED!</h1>
            <p className="text-sm font-black uppercase">전략 제출 완료. 레이싱을 지켜보세요!</p>
          </div>

          <div className="brutal-card p-6">
            <h3 className="text-xl font-brutal uppercase mb-6 underline decoration-4 decoration-yellow-400">Tactical Summary</h3>
            <div className="space-y-4">
              {displayPushes.map((p, i) => {
                const racer = racers[p.racerId - 1];
                return (
                  <div key={i} className="flex justify-between items-center p-4 border-2 border-black bg-white">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 border-2 border-black" style={{ backgroundColor: racer?.color || '#888' }}></div>
                        <span className="font-black text-lg">TRK {p.racerId}</span>
                     </div>
                     <span className={`text-3xl font-racing font-black ${p.count > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {p.count > 0 ? '+' : ''}{p.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-full bg-slate-50">
      <MobileHeader />

      <div className="w-full max-w-md px-4 pb-12">
        <div className="brutal-card bg-black text-white p-6 mb-8 flex justify-between items-center shadow-[6px_6px_0px_0px_rgba(234,179,8,1)] border-yellow-400">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Push Allowance</p>
            <p className="text-5xl font-racing font-black leading-none text-yellow-400">{team.totalPushAllowance}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Balance</p>
            <p className={`text-5xl font-racing font-black leading-none ${remaining === 0 ? 'text-lime-400' : remaining < 0 ? 'text-red-500' : 'text-orange-400'}`}>
              {remaining}
            </p>
          </div>
        </div>

        <div className="mb-6 px-2">
           <h1 className="text-3xl font-brutal uppercase italic leading-none">COMMAND CENTER</h1>
           <div className="h-2 w-20 bg-black mt-2"></div>
           <p className="text-[10px] font-black text-black/40 mt-3 uppercase italic">전략적으로 PUSH를 배분하세요.</p>
        </div>

        <div className="space-y-4 mb-10">
           {racers.map((racer, i) => (
             <div key={racer.id} className={`flex items-center gap-3 p-3 brutal-card transition-all ${pushes[i] !== 0 ? 'bg-white border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white/80'}`}>
                <div className="w-16 flex flex-col items-center gap-1 border-r-2 border-black pr-2">
                  <div className="w-10 h-10 border-4 border-black flex items-center justify-center font-black text-white text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                       style={{ backgroundColor: racer.color }}>
                    {racer.id}
                  </div>
                  <span className="text-[8px] font-black uppercase">POS: {racer.position}</span>
                </div>

                <div className="flex-1 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handlePushChange(i, pushes[i] - 1)}
                    className="w-12 h-12 brutal-btn bg-white text-3xl flex items-center justify-center font-black"
                  >–</button>

                  <div className="flex-1 min-w-[60px] relative">
                    <input
                      type="number"
                      className="w-full brutal-input text-center text-3xl font-black bg-white outline-none focus:ring-4 ring-yellow-400 p-0 h-14"
                      value={pushes[i] === 0 ? '0' : pushes[i]}
                      onChange={(e) => handlePushChange(i, parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <button
                    onClick={() => handlePushChange(i, pushes[i] + 1)}
                    className="w-12 h-12 brutal-btn bg-white text-3xl flex items-center justify-center font-black"
                  >+</button>
                </div>
             </div>
           ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={remaining !== 0}
          className={`brutal-btn w-full py-6 text-2xl uppercase italic ${remaining === 0 ? 'bg-black text-white' : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed shadow-none transform-none'}`}
        >
          EXECUTE ORDER
        </button>
      </div>
    </div>
  );
};

export default TeamPushControl;
