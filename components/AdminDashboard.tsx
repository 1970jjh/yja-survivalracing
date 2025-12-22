import React, { useState, useEffect, useRef } from 'react';
import { GameState, Team, TimerState, RevealState } from '../types';
import { RacerCarImage, CLIFF_IMAGE } from '../constants';
import { updateTimerPartial } from '../firebase';
import TeamPushControl from './TeamPushControl';
import TeamSponsorship from './TeamSponsorship';

// 자동차 시동 소리 URL (무료 효과음)
const CAR_ENGINE_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3';
// 타이머 알람 소리 URL
const TIMER_ALARM_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface AdminDashboardProps {
  gameState: GameState;
  updateState: (s: GameState | null) => void;
  onExit: () => void;
  previewMode?: boolean;
  onTogglePreview: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  gameState,
  updateState,
  onExit,
  previewMode,
  onTogglePreview
}) => {
  const [totalPushInput, setTotalPushInput] = useState(gameState.adminTotalPush || 10);
  const [timerMinutes, setTimerMinutes] = useState(3);
  const [teamRanks, setTeamRanks] = useState<Record<string, number>>({});
  const [pendingAllocations, setPendingAllocations] = useState<Record<string, number>>({});
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [previewTeamIndex, setPreviewTeamIndex] = useState(0);
  const [showMiniGamePopup, setShowMiniGamePopup] = useState(true);
  const carSoundRef = useRef<HTMLAudioElement | null>(null);
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);

  // 퀵 타이머 상태
  const [showQuickTimer, setShowQuickTimer] = useState(false);
  const [quickTimerInputMin, setQuickTimerInputMin] = useState(1);
  const [quickTimerInputSec, setQuickTimerInputSec] = useState(0);
  const [quickTimerRemaining, setQuickTimerRemaining] = useState(0);
  const [quickTimerRunning, setQuickTimerRunning] = useState(false);

  // 최종 결과 단계 (false: 레이서 순위, true: 팀 수익)
  const [showTeamResults, setShowTeamResults] = useState(false);

  // 자동차 소리 재생 함수
  const playCarSound = () => {
    if (carSoundRef.current) {
      carSoundRef.current.currentTime = 0;
      carSoundRef.current.play().catch(() => {});
    }
  };

  // 알람 소리 재생 함수
  const playAlarmSound = () => {
    if (alarmSoundRef.current) {
      alarmSoundRef.current.currentTime = 0;
      alarmSoundRef.current.play().catch(() => {});
    }
  };

  // 알람 소리 정지 함수
  const stopAlarmSound = () => {
    if (alarmSoundRef.current) {
      alarmSoundRef.current.pause();
      alarmSoundRef.current.currentTime = 0;
    }
  };

  // 안전한 기본값
  const teams = gameState.teams || [];
  const racers = gameState.racers || [];
  const timer = gameState.timer || { isRunning: false, totalSeconds: 180, remainingSeconds: 180 };
  const revealState = gameState.revealState || { revealedTeamIds: [] };

  // 미니게임 상태가 되면 팝업 표시
  useEffect(() => {
    if (gameState.status === 'MINI_GAME') {
      setShowMiniGamePopup(true);
    }
  }, [gameState.status]);

  // 타이머 카운트다운 - 부분 업데이트 사용 (팀 데이터 덮어쓰기 방지)
  useEffect(() => {
    if (!gameState.timer?.isRunning || gameState.timer.remainingSeconds <= 0) return;

    const interval = setInterval(async () => {
      const newRemaining = Math.max(0, gameState.timer.remainingSeconds - 1);

      // 시간이 다 되면 타이머만 정지 (자동 랜덤 배분 없음 - 참가자가 직접 제출해야 함)
      if (newRemaining <= 0) {
        try {
          await updateTimerPartial(gameState.id, {
            isRunning: false,
            remainingSeconds: 0
          });
        } catch (error) {
          console.error('타이머 업데이트 실패:', error);
        }
      } else {
        // 타이머만 부분 업데이트 (팀 데이터 보존)
        try {
          await updateTimerPartial(gameState.id, {
            remainingSeconds: newRemaining
          });
        } catch (error) {
          console.error('타이머 업데이트 실패:', error);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.timer?.isRunning, gameState.timer?.remainingSeconds, gameState.id]);

  // 퀵 타이머 카운트다운
  useEffect(() => {
    if (!quickTimerRunning || quickTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setQuickTimerRemaining(prev => {
        if (prev <= 1) {
          setQuickTimerRunning(false);
          // 시간 종료 시 알람 재생
          playAlarmSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quickTimerRunning, quickTimerRemaining]);

  // 퀵 타이머 시작
  const startQuickTimer = () => {
    const totalSeconds = quickTimerInputMin * 60 + quickTimerInputSec;
    if (totalSeconds > 0) {
      setQuickTimerRemaining(totalSeconds);
      setQuickTimerRunning(true);
      stopAlarmSound();
    }
  };

  // 퀵 타이머 정지
  const stopQuickTimer = () => {
    setQuickTimerRunning(false);
    stopAlarmSound();
  };

  // 퀵 타이머 리셋
  const resetQuickTimer = () => {
    setQuickTimerRunning(false);
    setQuickTimerRemaining(0);
    stopAlarmSound();
  };

  // 미니게임 시작
  const startMiniGame = () => {
    updateState({ ...gameState, status: 'MINI_GAME' });
  };

  // 스폰서십 단계 시작
  const startSponsoring = () => {
    updateState({ ...gameState, status: 'SPONSORING' });
  };

  // Push 배분 계산 (1등 입력값 기준, 순위별 차등 배분)
  // 예: 1등 10칸 → 2등 8칸(-2) → 3등 7칸(-1) → 4등 6칸(-1) → ...
  const handleRunAllocation = () => {
    const currentTeams = gameState.teams || [];

    // 순위가 1 이상인 팀 확인
    const teamsWithRanks = currentTeams.filter(t => teamRanks[t.id] >= 1);
    if (teamsWithRanks.length === 0) {
      alert('최소 1개 팀의 순위를 입력해주세요.');
      return;
    }

    const firstPlacePush = totalPushInput;
    const newAllocations: Record<string, number> = {};

    // 순위가 입력된 팀만 순위별로 정렬
    const sortedTeams = [...teamsWithRanks].sort((a, b) => {
      const rankA = teamRanks[a.id] || 999;
      const rankB = teamRanks[b.id] || 999;
      return rankA - rankB;
    });

    // 각 팀에 할당량 계산 (1등 기준, 2등은 -2, 그 이후는 -1씩)
    sortedTeams.forEach((team) => {
      const rank = teamRanks[team.id];
      let allocation: number;

      if (rank === 1) {
        allocation = firstPlacePush;
      } else if (rank === 2) {
        allocation = firstPlacePush - 2;
      } else {
        // 3등부터는 2등에서 순위마다 -1
        allocation = firstPlacePush - 2 - (rank - 2);
      }

      // 최소 1칸 보장
      newAllocations[team.id] = Math.max(allocation, 1);
    });

    setPendingAllocations(newAllocations);
  };

  // 팀에 Push 권한 배분 및 타이머 시작
  const handlePushToTeams = () => {
    const currentTeams = gameState.teams || [];
    const newTeams = currentTeams.map(team => ({
      ...team,
      totalPushAllowance: pendingAllocations[team.id] || 0,
      hasSubmittedPushes: false,
      currentRoundPushes: [],
      miniGameRank: teamRanks[team.id]
    }));

    const newTimer: TimerState = {
      isRunning: true,
      totalSeconds: timerMinutes * 60,
      remainingSeconds: timerMinutes * 60,
      startedAt: Date.now()
    };

    const newReveal: RevealState = {
      revealedTeamIds: []
    };

    updateState({
      ...gameState,
      teams: newTeams,
      status: 'PUSH_INPUT',
      adminTotalPush: totalPushInput,
      timer: newTimer,
      revealState: newReveal
    });
  };

  // 타이머 일시정지/재개
  const toggleTimer = () => {
    const newTimer: TimerState = {
      ...timer,
      isRunning: !timer.isRunning
    };
    updateState({ ...gameState, timer: newTimer });
  };

  // 타이머 리셋
  const resetTimer = () => {
    const newTimer: TimerState = {
      isRunning: false,
      totalSeconds: timerMinutes * 60,
      remainingSeconds: timerMinutes * 60
    };
    updateState({ ...gameState, timer: newTimer });
  };

  // 결과 공개 모드로 전환 (INP 최적화: 비동기 처리)
  const startRevealing = () => {
    const currentTeams = gameState.teams || [];
    // 모든 팀이 제출했는지 확인
    const allSubmitted = currentTeams.every(t => t.hasSubmittedPushes || t.totalPushAllowance === 0);
    if (!allSubmitted) {
      // 미제출 팀이 있으면 확인 (자동 랜덤 배분 없음 - 0으로 처리)
      if (!confirm('아직 제출하지 않은 팀이 있습니다. 미제출 팀은 PUSH 0으로 처리됩니다. 계속하시겠습니까?')) {
        return;
      }
    }
    // 비동기로 상태 업데이트 (INP 최적화)
    requestAnimationFrame(() => {
      updateState({
        ...gameState,
        status: 'REVEALING',
        timer: { ...timer, isRunning: false }
      });
    });
  };

  // 팀 결과 공개 (한 팀씩) - INP 최적화
  const revealTeam = (teamId: string) => {
    // 자동차 시동 소리 즉시 재생
    playCarSound();

    // 무거운 작업은 비동기로 처리
    requestAnimationFrame(() => {
      const currentTeams = gameState.teams || [];
      const team = currentTeams.find(t => t.id === teamId);
      if (!team) return;

      const currentRacers = gameState.racers || [];
      const currentPushes = team.currentRoundPushes || [];
      // 레이서 위치 업데이트
      const newRacers = currentRacers.map(racer => {
        const push = currentPushes.find(p => p.racerId === racer.id);
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

      // 공개된 팀 목록에 추가
      const currentRevealedIds = gameState.revealState?.revealedTeamIds || [];
      const newRevealState: RevealState = {
        revealedTeamIds: [...currentRevealedIds, teamId],
        currentRevealingTeamId: teamId
      };

      updateState({
        ...gameState,
        racers: newRacers,
        revealState: newRevealState
      });
    });
  };

  // 이미 공개된 팀 결과 다시보기 (자동차 위치 변경 없음)
  const showTeamResultAgain = (teamId: string) => {
    const newRevealState: RevealState = {
      ...gameState.revealState,
      revealedTeamIds: gameState.revealState?.revealedTeamIds || [],
      currentRevealingTeamId: teamId
    };
    updateState({
      ...gameState,
      revealState: newRevealState
    });
  };

  // 다음 라운드로 - INP 최적화
  const nextRound = () => {
    requestAnimationFrame(() => {
      if (gameState.currentRound < gameState.totalRounds) {
        const newTimer: TimerState = {
          isRunning: false,
          totalSeconds: 180,
          remainingSeconds: 180
        };
        const newReveal: RevealState = {
          revealedTeamIds: []
        };
        updateState({
          ...gameState,
          currentRound: gameState.currentRound + 1,
          status: 'MINI_GAME',
          revealState: newReveal,
          timer: newTimer
        });
        setTeamRanks({});
        setPendingAllocations({});
      } else {
        calculateFinalResults();
      }
    });
  };

  // 최종 결과 계산 - INP 최적화
  const calculateFinalResults = () => {
    // 결과 화면 초기화
    setShowTeamResults(false);

    requestAnimationFrame(() => {
      const currentRacers = gameState.racers || [];
      const currentTeams = gameState.teams || [];
      const activeRacers = [...currentRacers]
        .filter(r => !r.isEliminated)
        .sort((a, b) => b.position - a.position);

      const teamIncomes = currentTeams.map(team => {
        let income = 0;
        const sponsorships = team.sponsorships || [];
        sponsorships.forEach(s => {
          const racerIdx = activeRacers.findIndex(r => r.id === s.racerId);
          if (racerIdx !== -1) {
            const multiplier = 8 - racerIdx;
            income += (s.amount * 10000000) * multiplier; // 천만원 단위
          }
          // 탈락한 레이서는 수익 0
        });
        return { ...team, totalPoints: income };
      });

      updateState({
        ...gameState,
        teams: teamIncomes,
        status: 'RESULTS'
      });
    });
  };

  // 게임 종료 - INP 최적화
  const finishGame = () => {
    if (confirm('게임을 완전히 종료하시겠습니까?')) {
      requestAnimationFrame(() => {
        updateState({ ...gameState, status: 'FINISHED' });
      });
    }
  };

  // 게임 리셋
  const resetGame = () => {
    if (confirm('게임을 초기화하시겠습니까? 모든 데이터가 삭제됩니다.')) {
      updateState(null);
      onExit();
    }
  };

  // 타이머 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 제출 현황
  const submittedCount = teams.filter(t => t.hasSubmittedPushes).length;
  const totalTeams = teams.length;
  const allTeamsSubmitted = totalTeams > 0 && teams.every(t => t.hasSubmittedPushes || t.totalPushAllowance === 0);

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none font-sans relative bg-slate-100">
      {/* 자동차 시동 소리 */}
      <audio ref={carSoundRef} src={CAR_ENGINE_SOUND} preload="auto" />
      {/* 타이머 알람 소리 */}
      <audio ref={alarmSoundRef} src={TIMER_ALARM_SOUND} preload="auto" loop />

      {/* BGM */}
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
            <h1 className="text-3xl font-black text-black italic leading-none">AI SURVIVAL RACING</h1>
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
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-black/60">Teams</span>
            <span className="text-lg font-black">{teams.length} / {gameState.maxTeams}</span>
          </div>
          <div className={`px-3 py-1 font-black text-xs uppercase ${
            gameState.status === 'LOBBY' ? 'bg-blue-500 text-white' :
            gameState.status === 'SPONSORING' ? 'bg-purple-500 text-white' :
            gameState.status === 'MINI_GAME' ? 'bg-orange-500 text-white' :
            gameState.status === 'PUSH_INPUT' ? 'bg-green-500 text-white' :
            gameState.status === 'REVEALING' ? 'bg-pink-500 text-white' :
            gameState.status === 'RESULTS' ? 'bg-yellow-600 text-white' :
            'bg-gray-500 text-white'
          }`}>
            {gameState.status}
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={() => setShowQuickTimer(true)} className={`brutal-btn px-4 py-2 text-sm ${quickTimerRunning ? 'bg-red-500 text-white animate-pulse' : 'bg-white'}`}>
            {quickTimerRunning ? `⏱ ${formatTime(quickTimerRemaining)}` : '⏱ TIMER'}
          </button>
          <button onClick={() => setIsMusicPlaying(!isMusicPlaying)} className={`brutal-btn px-4 py-2 text-sm ${isMusicPlaying ? 'bg-green-500 text-white' : 'bg-white'}`}>
            {isMusicPlaying ? '⏹ BGM' : '▶ BGM'}
          </button>
          <button onClick={onTogglePreview} className={`brutal-btn px-4 py-2 text-sm ${previewMode ? 'bg-cyan-400' : 'bg-white'}`}>
            {previewMode ? '🏁 대시보드' : '👁 참가자 화면'}
          </button>
          <button onClick={resetGame} className="brutal-btn bg-gray-500 text-white px-4 py-2 text-sm">리셋</button>
          <button onClick={onExit} className="brutal-btn bg-red-500 text-white px-4 py-2 text-sm">나가기</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {previewMode ? (
          /* 참가자 화면 미리보기 */
          <div className="flex-1 p-8 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50 overflow-hidden">
            <div className="bg-white p-4 rounded-[40px] border-[8px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] relative w-[375px] h-[780px] max-h-full overflow-hidden flex flex-col">
              <div className="mt-12 flex justify-center gap-1.5 px-4 overflow-x-auto scrollbar-hide py-2 border-b-4 border-black">
                {teams.map((t, idx) => (
                  <button key={t.id} onClick={() => setPreviewTeamIndex(idx)} className={`px-3 py-1 border-2 border-black font-black text-[10px] transition-all ${previewTeamIndex === idx ? 'bg-yellow-400' : 'bg-white'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto pt-4 scrollbar-hide">
                {teams.length > 0 && (gameState.status === 'LOBBY' || gameState.status === 'SPONSORING' ? (
                  <TeamSponsorship team={teams[previewTeamIndex] || teams[0]} gameState={gameState} onUpdate={() => {}} />
                ) : (
                  <TeamPushControl team={teams[previewTeamIndex] || teams[0]} gameState={gameState} onUpdate={() => {}} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 관리자 대시보드 */
          <div className="flex-1 flex flex-col p-4 overflow-y-auto gap-4">
            {/* 타이머 & 제출 현황 */}
            {(gameState.status === 'PUSH_INPUT' || gameState.status === 'REVEALING') && (
              <div className={`flex gap-4 items-center justify-center p-4 rounded-lg ${allTeamsSubmitted ? 'bg-green-600' : 'bg-black'}`}>
                <div className={`text-6xl font-black ${allTeamsSubmitted ? 'text-white' : timer.remainingSeconds <= 30 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                  {allTeamsSubmitted ? '✅ 완료!' : formatTime(timer.remainingSeconds)}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-white text-sm font-black">
                    제출 현황: <span className={allTeamsSubmitted ? 'text-yellow-300' : 'text-yellow-400'}>{submittedCount}</span> / {totalTeams} 팀
                    {allTeamsSubmitted && <span className="ml-2 text-yellow-300">🎉 모두 제출!</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={toggleTimer} className={`brutal-btn px-4 py-2 text-sm ${timer.isRunning ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                      {timer.isRunning ? '⏸ 일시정지' : '▶ 재개'}
                    </button>
                    <button onClick={resetTimer} className="brutal-btn bg-gray-500 text-white px-4 py-2 text-sm">
                      🔄 리셋
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 레이스 트랙 */}
            <div className="flex-1 brutal-card p-4 flex flex-col relative overflow-hidden bg-white">
              {/* 현재 공개 중인 팀 결과 배너 */}
              {revealState.currentRevealingTeamId && (
                <div className="bg-black text-center py-3 mb-2 border-4 border-yellow-400">
                  {(() => {
                    const revealingTeam = teams.find(t => t.id === revealState.currentRevealingTeamId);
                    if (!revealingTeam) return null;
                    const pushes = revealingTeam.currentRoundPushes || [];
                    const pushText = pushes
                      .filter(p => p.count !== 0)
                      .map(p => `${p.racerId}번 ${p.count > 0 ? '+' : ''}${p.count}칸`)
                      .join(' / ');
                    return (
                      <span className="text-2xl font-black text-red-500">
                        {revealingTeam.index}조 결과 : {pushText || '없음'}
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* 트랙 번호 - 크고 진하게 */}
              <div className="flex h-10 border-b-4 border-black bg-yellow-50">
                <div className="w-20 flex-shrink-0"></div>
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="flex-1 flex items-center justify-center text-lg font-black text-black border-r border-black/30">
                    {i + 1}
                  </div>
                ))}
                <div className="w-28 flex-shrink-0 bg-black/40 flex items-center justify-center">
                  <span className="text-sm font-black text-white drop-shadow-lg">CLIFF</span>
                </div>
              </div>

              {/* 레이서 트랙 + 절벽 통합 영역 */}
              <div className="flex-1 flex border-4 border-black border-t-0">
                {/* 트랙 영역 */}
                <div className="flex-1 flex flex-col">
                  {racers.map(racer => {
                    // 현재 공개된 팀의 이 레이서에 대한 푸시 찾기
                    const revealingTeam = revealState.currentRevealingTeamId
                      ? teams.find(t => t.id === revealState.currentRevealingTeamId)
                      : null;
                    const currentPush = revealingTeam?.currentRoundPushes?.find(p => p.racerId === racer.id);

                    return (
                      <div key={racer.id} className="flex-1 flex border-b border-black last:border-b-0 min-h-[60px]">
                        {/* 트랙 번호 라벨 */}
                        <div className="w-20 bg-black flex items-center justify-center flex-shrink-0 gap-1">
                          <span className="text-white font-black text-[10px]">TRK {racer.id}</span>
                          <div className="w-4 h-4 border border-white" style={{ backgroundColor: racer.color }}></div>
                        </div>

                        {/* 20칸 그리드 */}
                        <div className="flex-1 flex relative">
                          {Array.from({ length: 20 }, (_, i) => (
                            <div
                              key={i}
                              className={`flex-1 border-r border-black/30 ${i === 19 ? 'bg-yellow-100' : ''}`}
                            ></div>
                          ))}

                          {/* 자동차 + 푸시 표시 */}
                          <div
                            className="absolute inset-y-0 transition-all duration-1000 ease-in-out flex items-center z-10"
                            style={{
                              // 각 칸의 중앙에 정확하게 위치시키기: 칸 N의 중앙 = (N - 0.5) / 20 * 100%
                              left: racer.position > 20 ? '105%' : racer.position <= 0 ? '0%' : `${((racer.position - 0.5) / 20) * 100}%`,
                              transform: `translateX(-50%) ${racer.isEliminated && racer.position > 20 ? 'rotate(90deg) translateY(100px)' : racer.isEliminated ? 'rotate(45deg) scale(0.6)' : ''}`,
                              opacity: racer.isEliminated && racer.position > 20 ? 0 : racer.isEliminated ? 0.3 : 1
                            }}
                          >
                            <div className="flex items-center gap-1">
                              {/* 마이너스 표시 (왼쪽) */}
                              {currentPush && currentPush.count < 0 && (
                                <span className="text-blue-600 font-black text-xl">{currentPush.count}</span>
                              )}

                              {/* 자동차 이미지 - 2배 크기 */}
                              <div className="bg-white/80 rounded shadow-lg">
                                <RacerCarImage racerId={racer.id} size={88} />
                              </div>

                              {/* 플러스 표시 (오른쪽) */}
                              {currentPush && currentPush.count > 0 && (
                                <span className="text-red-600 font-black text-xl">+{currentPush.count}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 절벽 영역 - 하나의 통합 이미지 */}
                <div className="w-28 relative overflow-hidden flex-shrink-0 border-l-4 border-black">
                  <img src={CLIFF_IMAGE} alt="Cliff" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30"></div>
                </div>
              </div>
            </div>

            {/* 컨트롤 패널 */}
            <div className="grid grid-cols-4 gap-4 min-h-[320px]">
              {/* 1. 게임 진행 */}
              <section className="brutal-card bg-blue-300 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">1</span>
                  <h3 className="font-black text-base uppercase">게임 진행</h3>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  {gameState.status === 'LOBBY' && (
                    <button onClick={startSponsoring} className="brutal-btn flex-1 bg-purple-500 text-white text-base font-black">
                      💰 스폰서십 시작
                    </button>
                  )}
                  {(gameState.status === 'LOBBY' || gameState.status === 'SPONSORING') && (
                    <button onClick={startMiniGame} className="brutal-btn flex-1 bg-orange-500 text-white text-base font-black">
                      🎮 미니게임 시작
                    </button>
                  )}
                  {gameState.status === 'PUSH_INPUT' && (
                    <button
                      onClick={startRevealing}
                      className={`brutal-btn flex-1 text-white text-base font-black ${allTeamsSubmitted ? 'bg-green-500 animate-pulse ring-4 ring-yellow-400' : 'bg-pink-500'}`}
                    >
                      {allTeamsSubmitted ? '✅ 모두 제출! 결과 공개' : '🎯 결과 공개 시작'}
                    </button>
                  )}
                  {gameState.status === 'REVEALING' && (
                    <button onClick={nextRound} className="brutal-btn flex-1 bg-black text-white text-base font-black">
                      ➡️ 다음 라운드
                    </button>
                  )}
                  {gameState.status === 'RESULTS' && (
                    <button onClick={finishGame} className="brutal-btn flex-1 bg-red-500 text-white text-base font-black">
                      🏁 게임 종료
                    </button>
                  )}
                </div>
              </section>

              {/* 2. 라운드 설정 */}
              <section className="brutal-card bg-cyan-300 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">2</span>
                  <h3 className="font-black text-base uppercase">라운드 설정</h3>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-black block mb-1">1등 PUSH</label>
                      <input type="number" className="brutal-input text-lg w-full font-black" value={totalPushInput} onChange={(e) => setTotalPushInput(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-black block mb-1">시간(분)</label>
                      <input type="number" className="brutal-input text-lg w-full font-black" value={timerMinutes} onChange={(e) => setTimerMinutes(parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <p className="text-xs text-black/60">2등: -2칸, 3등~: -1칸씩</p>
                </div>
              </section>

              {/* 3. 미니게임 순위 */}
              <section className="brutal-card bg-lime-400 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">3</span>
                  <h3 className="font-black text-base uppercase">미니게임 순위</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 mb-2">
                  {teams.length === 0 ? (
                    <div className="text-center py-4 text-base text-black/50 font-bold">
                      등록된 팀이 없습니다
                    </div>
                  ) : (
                    teams
                      .sort((a, b) => (a.index || 0) - (b.index || 0))
                      .map((team) => (
                        <div key={team.id} className="flex gap-2 items-center bg-white/50 p-2 border-2 border-black rounded">
                          <div className="w-12 h-12 bg-black text-yellow-400 flex items-center justify-center font-black rounded text-sm">
                            {team.index}조
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-black text-black/60 truncate">{team.name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-black/40">순위:</span>
                              <input
                                type="number"
                                min="1"
                                max={teams.length}
                                placeholder="#"
                                className="w-14 border-2 border-black p-1 text-center text-base font-black bg-white"
                                value={teamRanks[team.id] || ''}
                                onChange={(e) => setTeamRanks({ ...teamRanks, [team.id]: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                          {pendingAllocations[team.id] !== undefined && (
                            <div className="flex flex-col items-center bg-yellow-400 px-3 py-1 border-2 border-black rounded">
                              <span className="text-[10px] font-black text-black/60">PUSH</span>
                              <span className="text-xl font-black">{pendingAllocations[team.id]}</span>
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
                {teams.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-center font-bold text-black/60">
                      1등 {totalPushInput}칸 / {teams.length}팀
                    </div>
                    <button onClick={handleRunAllocation} className="brutal-btn w-full py-3 bg-white text-sm font-black">
                      📊 배분 계산
                    </button>
                  </div>
                )}
              </section>

              {/* 4. 팀별 PUSH 공개 */}
              <section className="brutal-card bg-orange-400 p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black text-lg">4</span>
                  <h3 className="font-black text-base uppercase">팀별 PUSH 공개</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 mb-2">
                  {teams.map(team => {
                    const isRevealed = revealState.revealedTeamIds?.includes(team.id);
                    const currentPushes = team.currentRoundPushes || [];
                    const pushSummary = currentPushes.map(p => `${p.racerId}번:${p.count > 0 ? '+' : ''}${p.count}`).join(', ');

                    return (
                      <div key={team.id} className={`p-3 border-2 border-black flex justify-between items-center ${isRevealed ? 'bg-green-200' : team.hasSubmittedPushes ? 'bg-yellow-100' : 'bg-white'}`}>
                        <div className="flex flex-col">
                          <span className="text-sm font-black">{team.index}조 {team.name}</span>
                          {team.hasSubmittedPushes && (
                            <span className="text-xs text-black/60">{pushSummary || '입력 없음'}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {/* 미공개 팀: 공개 버튼 (REVEALING 상태에서만) */}
                          {gameState.status === 'REVEALING' && !isRevealed && (
                            <button onClick={() => revealTeam(team.id)} className="text-xs font-black px-3 py-1.5 bg-pink-500 text-white">
                              공개
                            </button>
                          )}
                          {/* 공개된 팀: 결과다시보기 버튼 (상태 무관) */}
                          {isRevealed && (
                            <button onClick={() => showTeamResultAgain(team.id)} className="text-xs font-black px-3 py-1.5 bg-blue-500 text-white">
                              결과다시보기
                            </button>
                          )}
                          {team.hasSubmittedPushes && (
                            <span className="text-xs font-black px-3 py-1.5 bg-green-500 text-white">제출</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {gameState.status === 'MINI_GAME' && (
                  <button onClick={handlePushToTeams} className="brutal-btn w-full py-3 bg-yellow-400 text-sm font-black">📤 PUSH 권한 전송</button>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {/* 퀵 타이머 팝업 */}
      {showQuickTimer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
          <div className="brutal-card bg-white p-8 text-center relative min-w-[400px]">
            {/* X 버튼 */}
            <button
              onClick={() => { setShowQuickTimer(false); stopAlarmSound(); }}
              className="absolute top-2 right-2 w-10 h-10 bg-black text-white rounded-full font-black text-xl hover:bg-red-500 transition-colors"
            >
              ✕
            </button>

            <h2 className="text-3xl font-black mb-6">⏱ QUICK TIMER</h2>

            {/* 타이머 디스플레이 */}
            <div className={`text-8xl font-black mb-8 ${quickTimerRemaining === 0 && !quickTimerRunning ? 'text-black' : quickTimerRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
              {quickTimerRemaining > 0 || quickTimerRunning ? formatTime(quickTimerRemaining) : formatTime(quickTimerInputMin * 60 + quickTimerInputSec)}
            </div>

            {/* 시간 입력 (타이머가 실행 중이 아닐 때만) */}
            {!quickTimerRunning && quickTimerRemaining === 0 && (
              <div className="flex gap-4 justify-center mb-6">
                <div className="flex flex-col items-center">
                  <label className="text-sm font-black mb-2">분</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="brutal-input w-24 text-center text-3xl font-black"
                    value={quickTimerInputMin}
                    onChange={(e) => setQuickTimerInputMin(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  />
                </div>
                <div className="flex flex-col items-center">
                  <label className="text-sm font-black mb-2">초</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="brutal-input w-24 text-center text-3xl font-black"
                    value={quickTimerInputSec}
                    onChange={(e) => setQuickTimerInputSec(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  />
                </div>
              </div>
            )}

            {/* 프리셋 버튼들 (타이머가 실행 중이 아닐 때만) */}
            {!quickTimerRunning && quickTimerRemaining === 0 && (
              <div className="flex gap-2 justify-center mb-6">
                <button onClick={() => { setQuickTimerInputMin(1); setQuickTimerInputSec(0); }} className="brutal-btn px-4 py-2 bg-gray-200 text-sm">1분</button>
                <button onClick={() => { setQuickTimerInputMin(2); setQuickTimerInputSec(0); }} className="brutal-btn px-4 py-2 bg-gray-200 text-sm">2분</button>
                <button onClick={() => { setQuickTimerInputMin(3); setQuickTimerInputSec(0); }} className="brutal-btn px-4 py-2 bg-gray-200 text-sm">3분</button>
                <button onClick={() => { setQuickTimerInputMin(5); setQuickTimerInputSec(0); }} className="brutal-btn px-4 py-2 bg-gray-200 text-sm">5분</button>
                <button onClick={() => { setQuickTimerInputMin(0); setQuickTimerInputSec(30); }} className="brutal-btn px-4 py-2 bg-gray-200 text-sm">30초</button>
              </div>
            )}

            {/* 컨트롤 버튼들 */}
            <div className="flex gap-4 justify-center">
              {!quickTimerRunning && quickTimerRemaining === 0 && (
                <button
                  onClick={startQuickTimer}
                  className="brutal-btn px-8 py-4 bg-green-500 text-white text-xl font-black"
                >
                  ▶ START
                </button>
              )}
              {quickTimerRunning && (
                <button
                  onClick={stopQuickTimer}
                  className="brutal-btn px-8 py-4 bg-red-500 text-white text-xl font-black"
                >
                  ⏸ STOP
                </button>
              )}
              {!quickTimerRunning && quickTimerRemaining > 0 && (
                <>
                  <button
                    onClick={() => setQuickTimerRunning(true)}
                    className="brutal-btn px-8 py-4 bg-green-500 text-white text-xl font-black"
                  >
                    ▶ RESUME
                  </button>
                  <button
                    onClick={resetQuickTimer}
                    className="brutal-btn px-8 py-4 bg-gray-500 text-white text-xl font-black"
                  >
                    🔄 RESET
                  </button>
                </>
              )}
              {/* 타이머 완료 시 */}
              {!quickTimerRunning && quickTimerRemaining === 0 && quickTimerInputMin === 0 && quickTimerInputSec === 0 && (
                <button
                  onClick={() => { stopAlarmSound(); setQuickTimerInputMin(1); }}
                  className="brutal-btn px-8 py-4 bg-yellow-400 text-black text-xl font-black"
                >
                  🔔 알람 끄기
                </button>
              )}
            </div>

            {/* 알람 끄기 버튼 (항상 표시) */}
            {quickTimerRemaining === 0 && !quickTimerRunning && (
              <button
                onClick={stopAlarmSound}
                className="mt-4 brutal-btn px-6 py-2 bg-orange-500 text-white text-sm font-black"
              >
                🔕 알람 정지
              </button>
            )}
          </div>
        </div>
      )}

      {/* 미니게임 팝업 */}
      {gameState.status === 'MINI_GAME' && showMiniGamePopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="brutal-card bg-yellow-400 p-12 text-center animate-bounce relative">
            {/* X 버튼 */}
            <button
              onClick={() => setShowMiniGamePopup(false)}
              className="absolute top-2 right-2 w-10 h-10 bg-black text-white rounded-full font-black text-xl hover:bg-red-500 transition-colors"
            >
              ✕
            </button>
            <h1 className="text-6xl font-black mb-4">🎮</h1>
            <h2 className="text-4xl font-black mb-2">#{gameState.currentRound}R MINI GAME</h2>
            <p className="text-lg font-black text-black/60">오프라인 미니게임을 진행해주세요!</p>
            <p className="text-sm font-black text-black/40 mt-4">순위 입력 후 "PUSH 권한 전송" 버튼을 눌러주세요</p>
          </div>
        </div>
      )}

      {/* 최종 결과 화면 - 레이서 순위 (1단계) */}
      {gameState.status === 'RESULTS' && !showTeamResults && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-auto p-8">
          <div className="brutal-card bg-white p-8 max-w-4xl w-full">
            <h1 className="text-4xl font-black text-center mb-8">🏆 레이서 최종 순위 🏆</h1>

            {/* 레이서 순위 */}
            <div className="mb-8">
              <div className="grid grid-cols-4 gap-4">
                {[...racers]
                  .sort((a, b) => {
                    if (a.isEliminated && !b.isEliminated) return 1;
                    if (!a.isEliminated && b.isEliminated) return -1;
                    return b.position - a.position;
                  })
                  .map((racer, idx) => (
                    <div key={racer.id} className={`p-4 border-4 border-black text-center ${racer.isEliminated ? 'bg-gray-300 opacity-50' : idx === 0 ? 'bg-yellow-400' : 'bg-white'}`}>
                      <div className="text-3xl font-black">{racer.isEliminated ? '💀' : `${idx + 1}등`}</div>
                      <div className="flex justify-center my-2">
                        <RacerCarImage racerId={racer.id} size={56} />
                      </div>
                      <div className="font-black">{racer.id}번 레이서</div>
                      <div className="text-sm text-black/60">위치: {racer.position}</div>
                    </div>
                  ))}
              </div>
            </div>

            <button onClick={() => setShowTeamResults(true)} className="brutal-btn w-full mt-8 py-6 bg-yellow-400 text-black text-2xl font-black animate-pulse">
              🏆 최종 순위 결과 보기 🏆
            </button>
          </div>
        </div>
      )}

      {/* 최종 결과 화면 - 팀 수익 (2단계) */}
      {gameState.status === 'RESULTS' && showTeamResults && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-auto p-8">
          <div className="brutal-card bg-white p-8 max-w-5xl w-full">
            <h1 className="text-5xl font-black text-center mb-10">🏆 최종 순위 결과 🏆</h1>

            {/* 팀 수익 - 크게 표시 */}
            <div className="space-y-6">
              {[...teams]
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .map((team, idx) => (
                  <div key={team.id} className={`p-8 border-4 border-black flex justify-between items-center ${idx === 0 ? 'bg-yellow-400 scale-105' : 'bg-white'}`}>
                    <div className="flex items-center gap-6">
                      <span className="font-black text-5xl">{idx + 1}등</span>
                      <div>
                        <span className="font-black text-3xl block">{team.index}조 {team.name}</span>
                        {/* 스폰 기록 - 검정색, 2배 크기 */}
                        <div className="text-xl font-black text-black mt-2">
                          스폰: {(team.sponsorships || []).map(s => `${s.racerId}번(${s.amount}천만)`).join(', ') || '없음'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-5xl text-green-600">
                        {(team.totalPoints / 100000000).toFixed(1)}억원
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setShowTeamResults(false)} className="brutal-btn flex-1 py-4 bg-gray-400 text-white text-xl">
                ← 레이서 순위 보기
              </button>
              <button onClick={finishGame} className="brutal-btn flex-1 py-4 bg-black text-white text-xl">
                🎉 게임 종료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
