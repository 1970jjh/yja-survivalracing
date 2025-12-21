
import React, { useState, useEffect } from 'react';
import { GameState, Racer, Team, PushDecision } from '../types';
import { CarIcon } from '../constants';
import TeamPushControl from './TeamPushControl';
import TeamSponsorship from './TeamSponsorship';

interface AdminDashboardProps {
  gameState: GameState;
  updateState: (s: GameState | null) => void;
  onExit: () => void;
  previewMode?: boolean;
  onTogglePreview: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ gameState, updateState, onExit, previewMode, onTogglePreview }) => {
  const [totalPushInput, setTotalPushInput] = useState(gameState.adminTotalPush || 47);
  const [timerInput, setTimerInput] = useState(3);
  const [teamRanks, setTeamRanks] = useState<Record<string, number>>({});
  const [pendingAllocations, setPendingAllocations] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [previewTeamIndex, setPreviewTeamIndex] = useState(0);

  useEffect(() => {
    let timer: number;
    if (timeLeft > 0) {
      timer = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Fix: Added missing startMiniGame function to transition status to MINI_GAME
  const startMiniGame = () => {
    updateState({ ...gameState, status: 'MINI_GAME' });
  };

  const handleRunAllocation = () => {
    const sortedTeams = [...gameState.teams].sort((a, b) => {
      const rankA = teamRanks[a.id] || 999;
      const rankB = teamRanks[b.id] || 999;
      return rankA - rankB;
    });

    const n = gameState.teams.length;
    const sumOfRanks = (n * (n + 1)) / 2;
    const newAllocations: Record<string, number> = {};

    sortedTeams.forEach((team, idx) => {
      const rank = teamRanks[team.id] || (idx + 1);
      const share = n - rank + 1;
      const allowance = Math.max(5, Math.round((totalPushInput / sumOfRanks) * share));
      newAllocations[team.id] = allowance;
    });

    setPendingAllocations(newAllocations);
  };

  const handlePushToTeams = () => {
    const newTeams = gameState.teams.map(team => ({
      ...team,
      totalPushAllowance: pendingAllocations[team.id] || 0,
      hasSubmittedPushes: false,
      currentRoundPushes: []
    }));

    updateState({ 
      ...gameState, 
      teams: newTeams, 
      status: 'PUSH_INPUT',
      adminTotalPush: totalPushInput 
    });
    setTimeLeft(timerInput * 60);
  };

  const processTeamPush = (teamId: string) => {
    const team = gameState.teams.find(t => t.id === teamId);
    if (!team || !team.currentRoundPushes.length) return;

    const newRacers = gameState.racers.map(racer => {
      const push = team.currentRoundPushes.find(p => p.racerId === racer.id);
      if (push) {
        let newPos = racer.position + push.count;
        let isEliminated = racer.isEliminated;
        if (newPos > 20) {
          newPos = 21; 
          isEliminated = true;
        } else if (newPos < 0) {
          newPos = 0;
        }
        return { ...racer, position: newPos, isEliminated };
      }
      return racer;
    });

    const newTeams = gameState.teams.map(t => 
      t.id === teamId ? { ...t, currentRoundPushes: [] } : t
    );

    updateState({ ...gameState, racers: newRacers, teams: newTeams });
  };

  const nextRound = () => {
    if (gameState.currentRound < gameState.totalRounds) {
      updateState({ 
        ...gameState, 
        currentRound: gameState.currentRound + 1, 
        status: 'LOBBY' 
      });
      setTeamRanks({});
      setPendingAllocations({});
    } else {
      // Calculate final
      const activeRacers = [...gameState.racers]
        .filter(r => !r.isEliminated)
        .sort((a, b) => b.position - a.position);
      
      const teamIncomes = gameState.teams.map(team => {
        let income = 0;
        team.sponsorships.forEach(s => {
          const racerIdx = activeRacers.findIndex(r => r.id === s.racerId);
          if (racerIdx !== -1) {
            const multiplier = 8 - racerIdx;
            income += (s.amount * 1000000) * multiplier;
          }
        });
        return { ...team, totalPoints: income };
      });

      updateState({ ...gameState, teams: teamIncomes, status: 'RESULTS' });
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none font-sans relative">
      {isMusicPlaying && (
        <iframe 
          width="0" height="0" 
          src="https://www.youtube.com/embed/8-6_CG-C8H0?autoplay=1&loop=1&playlist=8-6_CG-C8H0" 
          frameBorder="0" allow="autoplay; encrypted-media" title="BGM"
        />
      )}

      {/* Header */}
      <div className="bg-yellow-400 p-4 flex justify-between items-center border-b-4 border-black z-20">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-black font-brutal italic leading-none">AI SURVIVAL RACING</h1>
            <span className="text-[12px] text-black font-black uppercase tracking-wider">ADMIN CONTROL CENTER</span>
          </div>
          <div className="h-10 w-1 bg-black"></div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-black/60">Course</span>
             <span className="text-lg font-black">{gameState.courseName}</span>
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-black/60">Round</span>
             <span className="text-lg font-black">{gameState.currentRound} / {gameState.totalRounds}</span>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          <button onClick={() => setIsMusicPlaying(!isMusicPlaying)} className={`brutal-btn px-6 py-2 ${isMusicPlaying ? 'bg-green-500' : 'bg-white'}`}>
            {isMusicPlaying ? '⏹ STOP BGM' : '▶ PLAY BGM'}
          </button>
          <button onClick={onTogglePreview} className={`brutal-btn px-6 py-2 ${previewMode ? 'bg-cyan-400' : 'bg-white'}`}>
            {previewMode ? '🏁 DASHBOARD' : '👁 USER VIEW'}
          </button>
          <button onClick={onExit} className="brutal-btn bg-red-500 text-white px-6 py-2">EXIT</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {previewMode ? (
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50 overflow-hidden">
            <div className="bg-white p-4 rounded-[40px] border-[8px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] relative w-[375px] h-[780px] max-h-full overflow-hidden flex flex-col">
               <div className="mt-12 flex justify-center gap-1.5 px-4 overflow-x-auto scrollbar-hide py-2 border-b-4 border-black">
                  {gameState.teams.map((t, idx) => (
                    <button key={t.id} onClick={() => setPreviewTeamIndex(idx)} className={`px-3 py-1 border-2 border-black font-black text-[10px] transition-all ${previewTeamIndex === idx ? 'bg-yellow-400' : 'bg-white'}`}>
                      {t.name}
                    </button>
                  ))}
               </div>
               <div className="flex-1 overflow-y-auto pt-4 scrollbar-hide">
                  {gameState.status === 'LOBBY' || gameState.status === 'SPONSORING' ? (
                    <TeamSponsorship team={gameState.teams[previewTeamIndex] || gameState.teams[0]} gameState={gameState} onUpdate={() => {}} />
                  ) : (
                    <TeamPushControl team={gameState.teams[previewTeamIndex] || gameState.teams[0]} gameState={gameState} onUpdate={() => {}} />
                  )}
               </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* The Track with Cliff */}
            <div className="flex-1 brutal-card p-4 flex flex-col relative mb-6 overflow-hidden bg-slate-100">
               {/* Numbers Above Track */}
               <div className="flex h-8 ml-24 mr-32 mb-1">
                  {Array.from({ length: 19 }, (_, i) => (
                    <div key={i} className="flex-1 flex items-center justify-center text-[10px] font-black text-black/40">{i+1}</div>
                  ))}
                  <div className="w-20 flex items-center justify-center text-[10px] font-black bg-black text-yellow-400">FINISH (20)</div>
               </div>

               <div className="flex-1 grid grid-rows-8 h-full gap-1 border-4 border-black bg-slate-300">
                  {gameState.racers.map(racer => (
                    <div key={racer.id} className="relative flex border-b-2 border-black last:border-b-0 bg-white">
                       <div className="w-24 bg-black flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-xs">TRK {racer.id}</span>
                       </div>
                       
                       <div className="flex-1 grid grid-cols-20 relative">
                          {Array.from({ length: 20 }, (_, i) => (
                            <div key={i} className={`border-r-2 border-black/10 flex items-center justify-center ${i === 19 ? 'bg-yellow-400/20' : ''}`}></div>
                          ))}
                          
                          {/* Car */}
                          <div 
                            className="absolute inset-y-0 transition-all duration-1000 ease-in-out flex items-center z-10"
                            style={{ 
                              left: racer.position > 20 ? '105%' : `${(racer.position / 20) * 100}%`,
                              transform: `translateX(-50%) ${racer.isEliminated && racer.position > 20 ? 'rotate(90deg) translateY(100px)' : racer.isEliminated ? 'rotate(45deg) scale(0.6)' : ''}`,
                              opacity: racer.isEliminated && racer.position > 20 ? 0 : racer.isEliminated ? 0.3 : 1
                            }}
                          >
                             <div className="p-1 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <CarIcon color={racer.color} size={36} />
                             </div>
                          </div>
                       </div>

                       {/* Cliff Area */}
                       <div className="w-32 bg-slate-900 relative overflow-hidden flex flex-col items-center justify-center">
                          <div className="absolute top-0 bottom-0 left-0 w-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">THE CLIFF</span>
                          <span className="text-[18px]">🏜️</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Horizontal Controls */}
            <div className="grid grid-cols-3 gap-6 h-[320px]">
              {/* (1) Round Initiation is now merged into (2) */}
              <section className="brutal-card bg-cyan-300 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">1</span>
                  <h3 className="font-brutal text-lg uppercase">라운드 설정</h3>
                </div>
                <div className="space-y-4">
                   <button onClick={startMiniGame} className="brutal-btn w-full py-4 bg-white text-black text-sm">🎮 미니게임 시작</button>
                   <div className="grid grid-cols-2 gap-2">
                     <div className="flex flex-col">
                        <label className="text-[10px] font-black mb-1">총 PUSH 배분</label>
                        <input type="number" className="brutal-input text-sm" value={totalPushInput} onChange={(e) => setTotalPushInput(parseInt(e.target.value) || 0)} />
                     </div>
                     <div className="flex flex-col">
                        <label className="text-[10px] font-black mb-1">제한시간(분)</label>
                        <input type="number" className="brutal-input text-sm" value={timerInput} onChange={(e) => setTimerInput(parseInt(e.target.value) || 0)} />
                     </div>
                   </div>
                </div>
              </section>

              {/* (2) Rankings & Allocation */}
              <section className="brutal-card bg-lime-400 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">2</span>
                  <h3 className="font-brutal text-lg uppercase">미니게임 순위 입력</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                   {gameState.teams.map((team, i) => (
                      <div key={team.id} className="flex gap-2 items-center bg-white/50 p-1 border-2 border-black">
                         <span className="text-[10px] font-black w-10">{team.index}팀</span>
                         <input 
                            type="number" 
                            placeholder="순위" 
                            className="w-16 border-2 border-black p-1 text-xs font-black"
                            value={teamRanks[team.id] || ''}
                            onChange={(e) => setTeamRanks({ ...teamRanks, [team.id]: parseInt(e.target.value) || 0 })}
                         />
                         <span className="text-[10px] font-bold text-black/40 truncate">{team.name}</span>
                      </div>
                   ))}
                </div>
                <button onClick={handleRunAllocation} className="brutal-btn w-full py-3 bg-white text-xs">권한배분 산출</button>
              </section>

              {/* (3) Reflection & Send to Teams */}
              <section className="brutal-card bg-orange-400 p-6 flex flex-col">
                 <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">3</span>
                  <h3 className="font-brutal text-lg uppercase">팀별 PUSH 반영</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                   {gameState.teams.map(team => (
                     <div key={team.id} className="p-2 border-2 border-black bg-white flex justify-between items-center">
                        <span className="text-[10px] font-black">{team.index}팀</span>
                        <input 
                          type="number" 
                          className="w-16 border-2 border-black p-1 text-xs font-black text-center"
                          value={pendingAllocations[team.id] || 0}
                          onChange={(e) => setPendingAllocations({ ...pendingAllocations, [team.id]: parseInt(e.target.value) || 0 })}
                        />
                        <button onClick={() => processTeamPush(team.id)} className={`text-[9px] font-black px-2 py-1 ${team.hasSubmittedPushes ? 'bg-pink-500 text-white' : 'bg-slate-200 text-slate-400'}`}>반영</button>
                     </div>
                   ))}
                </div>
                <div className="flex gap-2">
                   <button onClick={handlePushToTeams} className="brutal-btn flex-1 py-4 bg-yellow-400 text-xs">팀별 PUSH 전송</button>
                   <button onClick={nextRound} className="brutal-btn flex-1 py-4 bg-black text-white text-xs">다음 라운드</button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
