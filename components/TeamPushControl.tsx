
import React, { useState, useEffect, useRef } from 'react';
import { Team, GameState, PushDecision } from '../types';

interface TeamPushControlProps {
  team: Team;
  gameState: GameState;
  onUpdate: (update: Partial<Team>) => void;
}

const TeamPushControl: React.FC<TeamPushControlProps> = ({ team, gameState, onUpdate }) => {
  const lastSentRef = useRef<string>("");
  const [pushes, setPushes] = useState<number[]>(new Array(8).fill(0));

  // 안전한 기본값
  const currentRoundPushes = team.currentRoundPushes || [];
  const racers = gameState.racers || [];

  useEffect(() => {
    if (currentRoundPushes.length > 0 && !team.hasSubmittedPushes) {
      const newPushes = new Array(8).fill(0);
      currentRoundPushes.forEach(p => {
        newPushes[p.racerId - 1] = p.count;
      });
      const pushStr = JSON.stringify(newPushes);
      if (pushStr !== lastSentRef.current) {
        setPushes(newPushes);
        lastSentRef.current = pushStr;
      }
    }
  }, [currentRoundPushes, team.hasSubmittedPushes]);

  const totalUsed = pushes.reduce((a, b) => a + Math.abs(b), 0);
  const remaining = team.totalPushAllowance - totalUsed;

  const handlePushChange = (racerIdx: number, val: number) => {
    const clamped = Math.max(-20, Math.min(20, val));
    const newPushes = [...pushes];
    newPushes[racerIdx] = clamped;
    setPushes(newPushes);
    
    const decisions: PushDecision[] = newPushes
      .map((p, i) => ({ racerId: i + 1, count: p }))
      .filter(p => p.count !== 0);
    
    lastSentRef.current = JSON.stringify(newPushes);
    onUpdate({ currentRoundPushes: decisions });
  };

  const validatePushes = (): string | null => {
    if (totalUsed !== team.totalPushAllowance) return "모든 PUSH 칸수를 정확히 사용해야 합니다.";
    const activeRacers = pushes.filter(p => p !== 0).length;
    if (activeRacers < 3) return "최소 3명의 레이서에게 배분해야 합니다.";
    const maxAllowedPerRacer = Math.floor(team.totalPushAllowance * 0.7);
    if (pushes.some(p => Math.abs(p) > maxAllowedPerRacer)) {
      return `한 레이서에게 과도한 배정은 금지됩니다 (최대 ${maxAllowedPerRacer}칸).`;
    }
    return null;
  };

  const handleSubmit = () => {
    const error = validatePushes();
    if (error) return alert(error);
    onUpdate({ hasSubmittedPushes: true });
  };

  // Header Component for Mobile UI
  const MobileHeader = () => (
    <div className="w-full bg-black text-white border-b-4 border-black mb-6 flex flex-col p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-end mb-2">
        <h1 className="text-2xl font-brutal italic leading-none text-yellow-400">SURVIVAL RACING</h1>
        <span className="text-[10px] font-black bg-white text-black px-2 py-0.5 rounded uppercase">Round {gameState.currentRound}</span>
      </div>
      <div className="flex justify-between items-center border-t border-white/20 pt-2">
        <span className="text-sm font-black uppercase italic tracking-wider">TEAM {team.name}</span>
        <span className="text-[8px] font-black text-white/50">{gameState.courseName}</span>
      </div>
    </div>
  );

  if (team.hasSubmittedPushes) {
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
              {currentRoundPushes.map((p, i) => {
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
