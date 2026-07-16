
import React, { useState, useEffect, useRef } from 'react';
import { Team, GameState, PushDecision } from '../types';
import { RacerCarImage } from '../constants';

// 금액을 한글 단위로 변환
const formatKoreanMoney = (amount: number): string => {
  const eok = Math.floor(amount / 100000000);
  const cheonman = Math.floor((amount % 100000000) / 10000000);
  if (eok > 0 && cheonman > 0) return `${eok}억 ${cheonman}천만원`;
  if (eok > 0) return `${eok}억원`;
  if (cheonman > 0) return `${cheonman}천만원`;
  return '0원';
};

// 공동 순위 계산
const getRacerRanks = (sortedRacers: { position: number; isEliminated: boolean }[]): number[] => {
  const ranks: number[] = [];
  let i = 0;
  while (i < sortedRacers.length) {
    if (sortedRacers[i].isEliminated) {
      ranks.push(-1);
      i++;
      continue;
    }
    let j = i;
    while (j < sortedRacers.length && !sortedRacers[j].isEliminated && sortedRacers[j].position === sortedRacers[i].position) {
      j++;
    }
    for (let k = i; k < j; k++) {
      ranks.push(i + 1);
    }
    i = j;
  }
  return ranks;
};

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

  // 제출 중 상태 (중복 제출 방지)
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // 현황보기(이전 라운드 기록 + 현재 위치) 펼침 상태
  const [showHistory, setShowHistory] = useState(false);

  // 안전한 기본값
  const racers = gameState.racers || [];
  const sponsorships = team.sponsorships || [];

  // 관리자가 현황보기를 활성화한 경우에만 참가자가 이전 기록/현재 위치를 볼 수 있음
  const statusVisible = !!gameState.showStatusView;

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
    // PUSH가 1개이면 최소 1명, 4개 이하이면 최소 2명, 그 외에는 최소 3명의 레이서에게 배분
    const minRacers = team.totalPushAllowance <= 1 ? 1 : team.totalPushAllowance <= 4 ? 2 : 3;
    if (activeRacers < minRacers) return `최소 ${minRacers}명의 레이서에게 배분해야 합니다.`;
    const maxAllowedPerRacer = Math.max(Math.floor(team.totalPushAllowance * 0.7), 1);
    if (pushes.some(p => Math.abs(p) > maxAllowedPerRacer)) {
      return `한 레이서에게 과도한 배정은 금지됩니다 (최대 ${maxAllowedPerRacer}칸).`;
    }
    return null;
  };

  // 제출 시 로컬 상태 먼저 업데이트 후 Firebase에 저장 (중복 제출 방지)
  const handleSubmit = async () => {
    // 이미 제출 중이거나 제출 완료된 경우 무시
    if (isSubmitting || isSubmittedLocally) {
      console.log('중복 제출 방지');
      return;
    }

    const error = validatePushes();
    if (error) {
      setTimeout(() => alert(error), 50);
      return;
    }

    // 제출 시작
    setIsSubmitting(true);

    // PUSH 결정 데이터 생성
    const decisions: PushDecision[] = pushes
      .map((p, i) => ({ racerId: i + 1, count: p }))
      .filter(p => p.count !== 0);

    // 로컬 상태 먼저 업데이트 (즉각적인 UI 반응)
    setIsSubmittedLocally(true);
    setSubmittedPushes(decisions);

    // Firebase에 저장
    try {
      await onUpdate({
        currentRoundPushes: decisions,
        hasSubmittedPushes: true
      });
    } catch (error) {
      console.error('제출 실패:', error);
      // 실패해도 로컬 상태는 유지 (Firebase 구독으로 동기화됨)
    } finally {
      setIsSubmitting(false);
    }
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
              <div key={i} className="bg-yellow-400 text-black p-2 rounded-lg text-center border-2 border-white flex flex-col items-center">
                <RacerCarImage racerId={String(s.racerId)} size={36} />
                <span className="text-lg font-black">#{s.racerId}</span>
                <span className="text-[10px] block font-bold">{s.amount}천만</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 현황보기 리포트 (관리자가 활성화했을 때만): 이전 라운드 전체 팀 결정 + 현재 레이서 위치
  const allTeams = gameState.teams || [];
  const previousRoundReport = statusVisible ? (
    <div className="w-full max-w-md px-4 mb-4">
      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full py-2 bg-black text-white rounded-lg text-sm font-black uppercase border-2 border-black active:bg-gray-800"
      >
        {showHistory ? '🔽 현황 닫기' : '📊 이전 라운드 현황 보기'}
      </button>
      {showHistory && (
        <div className="mt-2 brutal-card bg-white p-3">
          {/* 현재 레이서 위치 */}
          <h3 className="text-xs font-black uppercase mb-2 border-b-2 border-black pb-1">현재 레이서 위치</h3>
          <div className="grid grid-cols-4 gap-1 mb-4">
            {racers.map(r => (
              <div key={r.id} className={`p-1 border border-black text-center ${r.isEliminated ? 'bg-gray-300 opacity-60' : 'bg-white'}`}>
                <div className="flex justify-center"><RacerCarImage racerId={String(r.id)} size={24} /></div>
                <div className="text-[10px] font-black">{r.id}번</div>
                <div className="text-[10px] font-black text-blue-700">{r.isEliminated ? '💀 탈락' : `${r.position}칸`}</div>
              </div>
            ))}
          </div>
          {/* 이전 라운드 팀별 PUSH 결정 */}
          <h3 className="text-xs font-black uppercase mb-2 border-b-2 border-black pb-1">이전 라운드 PUSH 기록</h3>
          <div className="space-y-1">
            {[...allTeams].sort((a, b) => (a.index || 0) - (b.index || 0)).map(t => {
              const prev = (t.previousRoundPushes || []).filter(p => p.count !== 0);
              return (
                <div key={t.id} className="flex items-start gap-2 text-[11px] border-b border-black/10 pb-1 last:border-b-0">
                  <span className="font-black whitespace-nowrap">{t.index}조</span>
                  <span className="font-bold text-black/70">
                    {prev.length === 0
                      ? '기록 없음'
                      : prev.map(p => `${p.racerId}번 ${p.count > 0 ? '+' : ''}${p.count}칸`).join(', ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  ) : null;

  // 최종 결과 화면 (참가자용)
  if (gameState.status === 'RESULTS' || gameState.status === 'FINISHED') {
    const allTeams = gameState.teams || [];
    const sortedTeams = [...allTeams].sort((a, b) => b.totalPoints - a.totalPoints);
    const racers = gameState.racers || [];

    return (
      <div className="flex flex-col items-center min-h-full bg-slate-50">
        <MobileHeader />
        <div className="w-full max-w-md px-4 pb-10">
          <div className="p-8 brutal-card bg-yellow-400 text-center mb-6">
            <span className="text-6xl block mb-4">🏆</span>
            <h1 className="text-3xl font-black uppercase leading-none">최종 순위 결과</h1>
          </div>

          {/* 레이서 최종 순위 */}
          <div className="brutal-card p-4 mb-6">
            <h3 className="text-lg font-black mb-3 border-b-2 border-black pb-1">레이서 순위</h3>
            <div className="grid grid-cols-4 gap-2">
              {(() => {
                const sorted = [...racers].sort((a, b) => {
                  if (a.isEliminated && !b.isEliminated) return 1;
                  if (!a.isEliminated && b.isEliminated) return -1;
                  return b.position - a.position;
                });
                const ranks = getRacerRanks(sorted);
                return sorted.map((racer, idx) => (
                  <div key={racer.id} className={`p-2 border-2 border-black text-center ${racer.isEliminated ? 'bg-gray-300 opacity-50' : ranks[idx] === 1 ? 'bg-yellow-400' : 'bg-white'}`}>
                    <div className="text-sm font-black">{racer.isEliminated ? '💀' : `${ranks[idx]}등`}</div>
                    <div className="flex justify-center my-1">
                      <RacerCarImage racerId={String(racer.id)} size={32} />
                    </div>
                    <div className="text-xs font-black">{racer.id}번</div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* 팀 순위 */}
          <div className="space-y-3">
            {(() => {
              const teamRankNumbers: number[] = [];
              for (let i = 0; i < sortedTeams.length; i++) {
                if (i === 0 || sortedTeams[i].totalPoints !== sortedTeams[i - 1].totalPoints) {
                  teamRankNumbers.push(i + 1);
                } else {
                  teamRankNumbers.push(teamRankNumbers[i - 1]);
                }
              }
              return sortedTeams.map((t, idx) => (
              <div key={t.id} className={`p-4 brutal-card ${t.id === team.id ? 'border-4 border-yellow-500 bg-yellow-50' : 'bg-white'} ${teamRankNumbers[idx] === 1 ? 'bg-yellow-400' : ''}`}>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-black text-3xl whitespace-nowrap">{teamRankNumbers[idx]}등</span>
                    <div className="min-w-0">
                      <span className="font-black text-xl block">{t.index}조 {t.name}</span>
                      <div className="text-xs text-black/60">
                        스폰: {(t.sponsorships || []).map(s => `${s.racerId}번(${s.amount}천만)`).join(', ') || '없음'}
                      </div>
                    </div>
                  </div>
                  <div className="font-black text-2xl text-green-600 whitespace-nowrap flex-shrink-0">
                    {formatKoreanMoney(t.totalPoints)}
                  </div>
                </div>
                {t.id === team.id && (
                  <div className="mt-2 text-xs font-black text-yellow-700 text-center">⭐ 우리 팀</div>
                )}
              </div>
            ));
            })()}
          </div>
        </div>
      </div>
    );
  }

  // 제출 완료 화면 (로컬 제출 상태 또는 Firebase 제출 상태)
  if (isSubmittedLocally || team.hasSubmittedPushes) {
    // 표시할 PUSH 데이터 (로컬 우선, 없으면 Firebase에서)
    const displayPushes = submittedPushes.length > 0 ? submittedPushes : (team.currentRoundPushes || []);

    return (
      <div className="flex flex-col items-center min-h-full bg-slate-50">
        <MobileHeader />
        {previousRoundReport}
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
                return (
                  <div key={i} className="flex justify-between items-center p-4 border-2 border-black bg-white">
                     <div className="flex items-center gap-4">
                        <RacerCarImage racerId={String(p.racerId)} size={40} />
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

      {previousRoundReport}

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
                  <div className="relative">
                    <RacerCarImage racerId={racer.id} size={44} />
                    <span className="absolute -bottom-1 -right-1 bg-black text-white text-[10px] font-black px-1 rounded">{racer.id}</span>
                  </div>
                  {statusVisible && <span className="text-[8px] font-black uppercase">POS: {racer.position}</span>}
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
          disabled={remaining !== 0 || isSubmitting}
          className={`brutal-btn w-full py-6 text-2xl uppercase italic ${
            isSubmitting
              ? 'bg-yellow-400 text-black animate-pulse cursor-not-allowed'
              : remaining === 0
                ? 'bg-black text-white'
                : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed shadow-none transform-none'
          }`}
        >
          {isSubmitting ? 'SUBMITTING...' : 'EXECUTE ORDER'}
        </button>
      </div>
    </div>
  );
};

export default TeamPushControl;
