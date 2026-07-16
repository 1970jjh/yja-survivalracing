import React, { useState, useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { GameState, Team, TimerState, RevealState } from '../types';
import { RacerCarImage, CLIFF_IMAGE } from '../constants';
import { updateTimerPartial, updateRacersPartial, updateRevealStatePartial, updateTeamsForPushAllocation, updateMultipleFieldsPartial } from '../firebase';
import TeamPushControl from './TeamPushControl';
import TeamSponsorship from './TeamSponsorship';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// F1 레이싱 카 사운드 URL
const CAR_ENGINE_SOUND = 'https://cdn.jsdelivr.net/gh/1970jjh/yja-survivalracing@main/car-engine-roaring-376881.mp3';
// 타이머 알람 소리 URL (무료 효과음 - Pixabay)
const TIMER_ALARM_SOUND = 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3';
// 미니게임 시작 효과음 (휘슬/시작 소리)
const GAME_START_SOUND = 'https://cdn.freesound.org/previews/263/263123_2064400-lq.mp3';
// 축하 환호 효과음
const CELEBRATION_SOUND = 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3';
// 절벽 추락 효과음
const CLIFF_FALL_SOUND = 'https://raw.githubusercontent.com/1970jjh/yja-survivalracing/main/queda-do-satelite-402171.mp3';
// 팡파레 효과음 (최종 결과)
const FANFARE_SOUND = 'https://cdn.pixabay.com/audio/2022/03/10/audio_132d3a1f05.mp3';

interface AdminDashboardProps {
  gameState: GameState;
  updateState: (s: GameState | null) => void;
  onExit: () => void;
  previewMode?: boolean;
  onTogglePreview: () => void;
  useFirebase: boolean;
}

// 금액을 한글 단위로 변환 (예: 630000000 → "6억 3천만원")
const formatKoreanMoney = (amount: number): string => {
  const eok = Math.floor(amount / 100000000); // 억
  const cheonman = Math.floor((amount % 100000000) / 10000000); // 천만

  if (eok > 0 && cheonman > 0) {
    return `${eok}억 ${cheonman}천만원`;
  } else if (eok > 0) {
    return `${eok}억원`;
  } else if (cheonman > 0) {
    return `${cheonman}천만원`;
  }
  return '0원';
};

// 공동 순위 계산: 정렬된 레이서 배열에서 각 인덱스의 순위를 반환
// 같은 position이면 같은 순위 (예: 1,2,3,3,5,5,7,8)
const getRacerRanks = (sortedRacers: { position: number; isEliminated: boolean }[]): number[] => {
  const ranks: number[] = [];
  let i = 0;
  while (i < sortedRacers.length) {
    if (sortedRacers[i].isEliminated) {
      ranks.push(-1); // eliminated
      i++;
      continue;
    }
    let j = i;
    while (j < sortedRacers.length && !sortedRacers[j].isEliminated && sortedRacers[j].position === sortedRacers[i].position) {
      j++;
    }
    for (let k = i; k < j; k++) {
      ranks.push(i + 1); // 1-based rank
    }
    i = j;
  }
  return ranks;
};

// 별도 브라우저 창(듀얼 모니터용)에 자식 요소를 렌더링하는 컴포넌트.
// 단순 포털이 아닌 별도의 React 루트를 사용하여, 팝업 창 안의 버튼/입력이
// 정상적으로 동작(이벤트 처리)하도록 한다.
const PopupWindow: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children
}) => {
  const rootRef = useRef<Root | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const externalWindow = window.open('', '', 'width=1280,height=860,left=120,top=80');
    if (!externalWindow) {
      alert('팝업 창이 차단되었습니다. 브라우저 주소창의 팝업 차단을 해제한 뒤 다시 시도해주세요.');
      onClose();
      return;
    }
    externalWindow.document.title = title;

    // 메인 문서의 스타일/폰트 복제 (커스텀 CSS + 구글 폰트)
    document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      externalWindow.document.head.appendChild(node.cloneNode(true));
    });
    // Tailwind CDN 주입
    const tw = externalWindow.document.createElement('script');
    tw.src = 'https://cdn.tailwindcss.com';
    externalWindow.document.head.appendChild(tw);

    externalWindow.document.body.style.margin = '0';
    externalWindow.document.body.style.background = '#f1f5f9';

    const mount = externalWindow.document.createElement('div');
    externalWindow.document.body.appendChild(mount);
    rootRef.current = createRoot(mount);
    setReady(true);

    const handleBeforeUnload = () => externalWindow.close();
    window.addEventListener('beforeunload', handleBeforeUnload);

    const poll = window.setInterval(() => {
      if (externalWindow.closed) {
        window.clearInterval(poll);
        onClose();
      }
    }, 500);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const r = rootRef.current;
      rootRef.current = null;
      // 렌더 중 동기 unmount 경고를 피하기 위해 다음 틱에 정리
      setTimeout(() => {
        try { r?.unmount(); } catch { /* noop */ }
      }, 0);
      externalWindow.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 부모 상태가 바뀔 때마다 팝업 내용 동기화
  useEffect(() => {
    if (ready && rootRef.current) {
      rootRef.current.render(children as React.ReactElement);
    }
  });

  return null;
};

// 자식을 인라인으로 두거나(popped=false) 별도 창으로 분리(popped=true)하는 래퍼
const Relocatable: React.FC<{
  popped: boolean;
  onClose: () => void;
  title: string;
  inlineClass: string;
  poppedClass: string;
  placeholder?: React.ReactNode;
  children: React.ReactNode;
}> = ({ popped, onClose, title, inlineClass, poppedClass, placeholder, children }) => {
  if (!popped) {
    return <div className={inlineClass}>{children}</div>;
  }
  return (
    <>
      {placeholder}
      <PopupWindow title={title} onClose={onClose}>
        <div className={poppedClass}>{children}</div>
      </PopupWindow>
    </>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  gameState,
  updateState,
  onExit,
  previewMode,
  onTogglePreview,
  useFirebase
}) => {
  const [totalPushInput, setTotalPushInput] = useState(gameState.adminTotalPush || 12);
  const [timerMinutes, setTimerMinutes] = useState(3);
  const [teamRanks, setTeamRanks] = useState<Record<string, number>>({});
  const [pendingAllocations, setPendingAllocations] = useState<Record<string, number>>({});
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [previewTeamIndex, setPreviewTeamIndex] = useState(0);
  const [showMiniGamePopup, setShowMiniGamePopup] = useState(true);
  // 컨트롤 패널을 별도 창(듀얼 모니터)으로 분리 표시
  const [showControlPopup, setShowControlPopup] = useState(false);
  const carSoundRef = useRef<HTMLAudioElement | null>(null);
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);
  const gameStartSoundRef = useRef<HTMLAudioElement | null>(null);
  const celebrationSoundRef = useRef<HTMLAudioElement | null>(null);
  const cliffFallSoundRef = useRef<HTMLAudioElement | null>(null);
  const fanfareSoundRef = useRef<HTMLAudioElement | null>(null);

  // 퀵 타이머 상태
  const [showQuickTimer, setShowQuickTimer] = useState(false);
  const [quickTimerInputMin, setQuickTimerInputMin] = useState(1);
  const [quickTimerInputSec, setQuickTimerInputSec] = useState(0);
  const [quickTimerRemaining, setQuickTimerRemaining] = useState(0);
  const [quickTimerRunning, setQuickTimerRunning] = useState(false);

  // 최종 결과 단계 (false: 레이서 순위, true: 팀 수익)
  const [showTeamResults, setShowTeamResults] = useState(false);

  // 스폰서십 검증 단계 상태
  const [showSponsorshipVerify, setShowSponsorshipVerify] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingSponsorships, setEditingSponsorships] = useState<{racerId: string, amount: number}[]>([]);

  // 팀 공개 중복 방지
  const [revealingTeamId, setRevealingTeamId] = useState<string | null>(null);

  // 최종 결과 다운로드용 ref
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const raceTrackRef = useRef<HTMLDivElement>(null);

  const captureResults = async (): Promise<HTMLCanvasElement | null> => {
    if (!resultsRef.current) return null;
    // Show download-only sections
    setIsCapturing(true);
    // Wait for DOM to update
    await new Promise(r => setTimeout(r, 100));
    try {
      // Capture race track first if available
      let raceTrackCanvas: HTMLCanvasElement | null = null;
      if (raceTrackRef.current) {
        raceTrackCanvas = await html2canvas(raceTrackRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        });
      }
      // Capture results section
      const resultsCanvas = await html2canvas(resultsRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      // If we have a race track, combine the canvases
      if (raceTrackCanvas) {
        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = Math.max(raceTrackCanvas.width, resultsCanvas.width);
        combinedCanvas.height = raceTrackCanvas.height + resultsCanvas.height + 40;
        const ctx = combinedCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
        // Center race track
        const trackX = (combinedCanvas.width - raceTrackCanvas.width) / 2;
        ctx.drawImage(raceTrackCanvas, trackX, 0);
        // Center results
        const resultsX = (combinedCanvas.width - resultsCanvas.width) / 2;
        ctx.drawImage(resultsCanvas, resultsX, raceTrackCanvas.height + 40);
        return combinedCanvas;
      }
      return resultsCanvas;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownloadPNG = async () => {
    setIsDownloading(true);
    try {
      const canvas = await captureResults();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `최종순위결과_${gameState.courseName || 'game'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG 다운로드 실패:', err);
      alert('PNG 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const canvas = await captureResults();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgWidth, imgHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`최종순위결과_${gameState.courseName || 'game'}.pdf`);
    } catch (err) {
      console.error('PDF 다운로드 실패:', err);
      alert('PDF 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

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

  // 미니게임 시작 소리 재생 함수
  const playGameStartSound = () => {
    if (gameStartSoundRef.current) {
      gameStartSoundRef.current.currentTime = 0;
      gameStartSoundRef.current.play().catch(() => {});
    }
  };

  // 축하 환호 소리 재생 함수
  const playCelebrationSound = () => {
    if (celebrationSoundRef.current) {
      celebrationSoundRef.current.currentTime = 0;
      celebrationSoundRef.current.play().catch(() => {});
    }
  };

  // 절벽 추락 소리 재생 함수
  const playCliffFallSound = () => {
    if (cliffFallSoundRef.current) {
      cliffFallSoundRef.current.currentTime = 0;
      cliffFallSoundRef.current.play().catch(() => {});
    }
  };

  // 팡파레 소리 재생 함수
  const playFanfareSound = () => {
    if (fanfareSoundRef.current) {
      fanfareSoundRef.current.currentTime = 0;
      fanfareSoundRef.current.play().catch(() => {});
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

  // 타이머 카운트다운 - Firebase 또는 로컬 상태 업데이트
  useEffect(() => {
    if (!gameState.timer?.isRunning || gameState.timer.remainingSeconds <= 0) return;

    const interval = setInterval(async () => {
      const newRemaining = Math.max(0, gameState.timer.remainingSeconds - 1);

      // 시간이 다 되면 타이머만 정지
      if (newRemaining <= 0) {
        if (useFirebase) {
          try {
            await updateTimerPartial(gameState.id, {
              isRunning: false,
              remainingSeconds: 0
            });
          } catch (error) {
            console.error('타이머 업데이트 실패:', error);
            // Firebase 실패 시 로컬 업데이트
            updateState({
              ...gameState,
              timer: { ...gameState.timer, isRunning: false, remainingSeconds: 0 }
            });
          }
        } else {
          // 오프라인 모드: 로컬 상태 업데이트
          updateState({
            ...gameState,
            timer: { ...gameState.timer, isRunning: false, remainingSeconds: 0 }
          });
        }
        // 시간 종료 시 알람 3초간 재생
        playAlarmSound();
        setTimeout(() => {
          stopAlarmSound();
        }, 3000);
      } else {
        // 타이머만 업데이트
        if (useFirebase) {
          try {
            await updateTimerPartial(gameState.id, {
              remainingSeconds: newRemaining
            });
          } catch (error) {
            console.error('타이머 업데이트 실패:', error);
            // Firebase 실패 시 로컬 업데이트
            updateState({
              ...gameState,
              timer: { ...gameState.timer, remainingSeconds: newRemaining }
            });
          }
        } else {
          // 오프라인 모드: 로컬 상태 업데이트
          updateState({
            ...gameState,
            timer: { ...gameState.timer, remainingSeconds: newRemaining }
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.timer?.isRunning, gameState.timer?.remainingSeconds, gameState.id, useFirebase, updateState]);

  // 퀵 타이머 카운트다운
  useEffect(() => {
    if (!quickTimerRunning || quickTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setQuickTimerRemaining(prev => {
        if (prev <= 1) {
          setQuickTimerRunning(false);
          // 시간 종료 시 알람 3초간 재생
          playAlarmSound();
          setTimeout(() => {
            stopAlarmSound();
          }, 3000);
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
    playGameStartSound(); // 미니게임 시작 효과음
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
      setTimeout(() => alert('최소 1개 팀의 순위를 입력해주세요.'), 50);
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
  const handlePushToTeams = async () => {
    const currentTeams = gameState.teams || [];

    const newTimer: TimerState = {
      isRunning: true,
      totalSeconds: timerMinutes * 60,
      remainingSeconds: timerMinutes * 60,
      startedAt: Date.now()
    };

    const newReveal: RevealState = {
      revealedTeamIds: []
    };

    const newTeams = currentTeams.map(team => ({
      ...team,
      totalPushAllowance: pendingAllocations[team.id] || 0,
      hasSubmittedPushes: false,
      currentRoundPushes: [],
      miniGameRank: teamRanks[team.id]
    }));

    // Firebase 사용 시 부분 업데이트 시도
    if (useFirebase) {
      try {
        const teamUpdates = currentTeams.map((team, index) => ({
          teamIndex: index,
          totalPushAllowance: pendingAllocations[team.id] || 0,
          miniGameRank: teamRanks[team.id]
        }));

        // 팀 할당량, 타이머, 공개 상태, 게임 상태를 부분 업데이트
        await updateTeamsForPushAllocation(gameState.id, teamUpdates);
        await updateTimerPartial(gameState.id, newTimer);
        await updateRevealStatePartial(gameState.id, newReveal);
        await updateMultipleFieldsPartial(gameState.id, {
          status: 'PUSH_INPUT',
          adminTotalPush: totalPushInput
        });

        console.log('PUSH 권한 부분 업데이트 성공');
        return;
      } catch (error) {
        console.error('Firebase 부분 업데이트 실패, 전체 업데이트로 폴백:', error);
      }
    }

    // 오프라인 모드 또는 Firebase 실패 시 전체 상태 업데이트
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

  // 결과 공개 모드로 전환 (INP 최적화: setTimeout으로 처리)
  const startRevealing = () => {
    setTimeout(() => {
      const currentTeams = gameState.teams || [];
      // 모든 팀이 제출했는지 확인
      const allSubmitted = currentTeams.every(t => t.hasSubmittedPushes || t.totalPushAllowance === 0);
      if (!allSubmitted) {
        // 미제출 팀이 있으면 확인 (자동 랜덤 배분 없음 - 0으로 처리)
        if (!confirm('아직 제출하지 않은 팀이 있습니다. 미제출 팀은 PUSH 0으로 처리됩니다. 계속하시겠습니까?')) {
          return;
        }
      }
      updateState({
        ...gameState,
        status: 'REVEALING',
        timer: { ...timer, isRunning: false }
      });
    }, 0);
  };

  // 팀 결과 공개 (한 팀씩) - 중복 클릭 방지 및 부분 업데이트
  const revealTeam = async (teamId: string) => {
    // 중복 클릭 방지: 이미 공개 중이거나 공개된 팀인 경우 무시
    const currentRevealedIds = gameState.revealState?.revealedTeamIds || [];
    if (revealingTeamId === teamId || currentRevealedIds.includes(teamId)) {
      console.log('팀 공개 중복 방지:', teamId);
      return;
    }

    // 공개 시작 표시
    setRevealingTeamId(teamId);

    // 자동차 시동 소리 즉시 재생
    playCarSound();

    // 무거운 작업은 비동기로 처리
    requestAnimationFrame(async () => {
      try {
        const currentTeams = gameState.teams || [];
        const team = currentTeams.find(t => t.id === teamId);
        if (!team) {
          setRevealingTeamId(null);
          return;
        }

        const currentRacers = gameState.racers || [];
        const currentPushes = team.currentRoundPushes || [];
        let hasCliffFall = false;
        // 레이서 위치 업데이트
        const newRacers = currentRacers.map(racer => {
          const push = currentPushes.find(p => p.racerId === racer.id);
          if (push) {
            let newPos = racer.position + push.count;
            let isEliminated = racer.isEliminated;
            if (newPos > 20) {
              newPos = 21;
              isEliminated = true;
              hasCliffFall = true; // 절벽 추락 발생
            } else if (newPos < 0) {
              newPos = 0;
            }
            return { ...racer, position: newPos, isEliminated };
          }
          return racer;
        });

        // 절벽 추락 시 효과음 재생 (1초 지연 - 자동차 이동 애니메이션 후)
        if (hasCliffFall) {
          setTimeout(() => playCliffFallSound(), 1000);
        }

        // 공개된 팀 목록에 추가 (중복 체크)
        const newRevealedIds = [...currentRevealedIds, teamId];
        const newRevealState: RevealState = {
          revealedTeamIds: newRevealedIds,
          currentRevealingTeamId: teamId
        };

        // Firebase 사용 시 부분 업데이트, 아니면 전체 업데이트
        if (useFirebase) {
          try {
            await updateRacersPartial(gameState.id, newRacers);
            await updateRevealStatePartial(gameState.id, newRevealState);
          } catch (error) {
            console.error('Firebase 부분 업데이트 실패, 전체 업데이트로 폴백:', error);
            updateState({
              ...gameState,
              racers: newRacers,
              revealState: newRevealState
            });
          }
        } else {
          // 오프라인 모드: 전체 상태 업데이트
          updateState({
            ...gameState,
            racers: newRacers,
            revealState: newRevealState
          });
        }
      } finally {
        // 공개 완료
        setTimeout(() => setRevealingTeamId(null), 500);
      }
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

  // 최종 결과 계산 - 스폰서십 검증 단계 추가
  const calculateFinalResults = () => {
    // 결과 화면 초기화
    setShowTeamResults(false);
    // 스폰서십 검증 화면 먼저 표시
    setShowSponsorshipVerify(true);
  };

  // 스폰서십 검증 완료 후 실제 결과 계산
  const proceedToResults = () => {
    setShowSponsorshipVerify(false);
    playFanfareSound(); // 팡파레 효과음

    requestAnimationFrame(() => {
      const currentRacers = gameState.racers || [];
      const currentTeams = gameState.teams || [];
      const activeRacers = [...currentRacers]
        .filter(r => !r.isEliminated)
        .sort((a, b) => b.position - a.position);

      // 공동 순위 처리: 같은 position의 레이서들은 같은 순위, 배수는 해당 순위들의 평균
      const racerMultipliers: Record<number, number> = {};
      let i = 0;
      while (i < activeRacers.length) {
        let j = i;
        // 같은 position인 레이서들 찾기
        while (j < activeRacers.length && activeRacers[j].position === activeRacers[i].position) {
          j++;
        }
        // i부터 j-1까지 같은 순위 → 배수의 평균 계산
        let sumMultiplier = 0;
        for (let k = i; k < j; k++) {
          sumMultiplier += 8 - k; // 원래 순위별 배수
        }
        const avgMultiplier = sumMultiplier / (j - i);
        for (let k = i; k < j; k++) {
          racerMultipliers[activeRacers[k].id] = avgMultiplier;
        }
        i = j;
      }

      const teamIncomes = currentTeams.map(team => {
        let income = 0;
        const sponsorships = team.sponsorships || [];
        sponsorships.forEach(s => {
          const multiplier = racerMultipliers[s.racerId];
          if (multiplier !== undefined) {
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

  // 스폰서십 수정 시작
  const startEditSponsorship = (team: Team) => {
    setEditingTeamId(team.id);
    // 기존 스폰서십 데이터 복사 또는 빈 배열 생성
    if (team.sponsorships && team.sponsorships.length > 0) {
      setEditingSponsorships(team.sponsorships.map(s => ({ racerId: s.racerId, amount: s.amount })));
    } else {
      // 기본값: 레이서 1, 2, 3에 각각 1천만원
      setEditingSponsorships([
        { racerId: '1', amount: 1 },
        { racerId: '2', amount: 1 },
        { racerId: '3', amount: 1 }
      ]);
    }
  };

  // 스폰서십 수정 저장
  const saveEditSponsorship = () => {
    if (!editingTeamId) return;

    const currentTeams = gameState.teams || [];
    const newTeams = currentTeams.map(team => {
      if (team.id === editingTeamId) {
        return {
          ...team,
          sponsorships: editingSponsorships
        };
      }
      return team;
    });

    updateState({
      ...gameState,
      teams: newTeams
    });

    setEditingTeamId(null);
    setEditingSponsorships([]);
  };

  // 스폰서십 수정 취소
  const cancelEditSponsorship = () => {
    setEditingTeamId(null);
    setEditingSponsorships([]);
  };

  // 게임 종료 - INP 최적화 (setTimeout으로 다음 이벤트 루프에서 처리)
  const finishGame = () => {
    setTimeout(() => {
      if (confirm('게임을 완전히 종료하시겠습니까?')) {
        updateState({ ...gameState, status: 'FINISHED' });
      }
    }, 50);
  };

  // 게임 리셋 - INP 최적화 (setTimeout으로 다음 이벤트 루프에서 처리)
  const resetGame = () => {
    setTimeout(() => {
      if (confirm('게임을 초기화하시겠습니까? 모든 데이터가 삭제됩니다.')) {
        updateState(null);
        onExit();
      }
    }, 50);
  };

  // 레이싱 중계 화면(1~8번 트랙)을 전체화면으로 크게 보기.
  // Fullscreen API를 사용하므로 브라우저 배율(확대/축소)과 무관하게 항상 전체가 보인다.
  const handleFullscreenRace = () => {
    const el = raceTrackRef.current;
    if (!el) return;
    const doc = document as Document & { webkitFullscreenElement?: Element };
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    if (anyEl.requestFullscreen) {
      anyEl.requestFullscreen().catch(() => {});
    } else if (anyEl.webkitRequestFullscreen) {
      anyEl.webkitRequestFullscreen();
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

  // 스폰서십 제출 상태 계산
  const teamsWithSponsorship = teams.filter(t => t.sponsorships && t.sponsorships.length >= 3);
  const allTeamsSponsorshipSubmitted = totalTeams > 0 && teamsWithSponsorship.length === totalTeams;

  return (
    <div className="flex flex-col h-screen overflow-hidden select-none font-sans relative bg-slate-100">
      {/* 자동차 시동 소리 */}
      <audio ref={carSoundRef} src={CAR_ENGINE_SOUND} preload="auto" />
      {/* 타이머 알람 소리 */}
      <audio ref={alarmSoundRef} src={TIMER_ALARM_SOUND} preload="auto" loop />
      {/* 미니게임 시작 소리 */}
      <audio ref={gameStartSoundRef} src={GAME_START_SOUND} preload="auto" />
      {/* 축하 환호 소리 */}
      <audio ref={celebrationSoundRef} src={CELEBRATION_SOUND} preload="auto" />
      {/* 절벽 추락 소리 */}
      <audio ref={cliffFallSoundRef} src={CLIFF_FALL_SOUND} preload="auto" />
      {/* 팡파레 소리 */}
      <audio ref={fanfareSoundRef} src={FANFARE_SOUND} preload="auto" />

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
          {/* QR 코드 - 교육생 참가용 */}
          <div className="flex flex-col items-center bg-white p-1 rounded border-2 border-black">
            <img
              src="https://i.ibb.co/tMvtGZcW/qr1.png"
              alt="참가 QR"
              className="w-[60px] h-[60px]"
            />
            <span className="text-[8px] font-black text-black">SCAN TO JOIN</span>
          </div>
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
          <button onClick={handleFullscreenRace} className="brutal-btn px-3 py-2 text-sm bg-white" title="레이싱 중계화면을 전체화면으로 크게 보기">
            ⛶ 중계화면
          </button>
          <button onClick={() => setShowControlPopup(v => !v)} className={`brutal-btn px-3 py-2 text-sm ${showControlPopup ? 'bg-indigo-500 text-white' : 'bg-white'}`} title="게임진행·라운드설정·PUSH공개 패널을 별도 창으로 분리 (듀얼 모니터)">
            🖥 {showControlPopup ? '컨트롤창 닫기' : '컨트롤창'}
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
            <div ref={raceTrackRef} className="flex-1 brutal-card p-4 flex flex-col relative overflow-hidden bg-white">
              {/* 현재 공개 중인 팀 결과 배너 - 브루탈리즘 3D 스타일 */}
              {revealState.currentRevealingTeamId && (
                <div className="bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 text-center py-4 mb-2 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
                  {/* 배경 패턴 */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{backgroundImage: 'repeating-linear-gradient(45deg, black 0, black 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px'}}></div>
                  </div>
                  {(() => {
                    const revealingTeam = teams.find(t => t.id === revealState.currentRevealingTeamId);
                    if (!revealingTeam) return null;
                    const pushes = revealingTeam.currentRoundPushes || [];
                    const filteredPushes = pushes.filter(p => p.count !== 0);
                    return (
                      <div className="relative z-10 flex items-center justify-center gap-4 flex-wrap">
                        {/* 팀 이름 배지 */}
                        <div className="bg-black text-yellow-400 px-4 py-2 border-4 border-yellow-400 shadow-[4px_4px_0px_0px_rgba(250,204,21,1)] transform -rotate-2">
                          <span className="text-2xl font-black">{revealingTeam.index}조</span>
                        </div>
                        <span className="text-3xl font-black text-black">결과</span>
                        {/* PUSH 결과 뱃지들 */}
                        <div className="flex gap-2 flex-wrap justify-center">
                          {filteredPushes.length === 0 ? (
                            <div className="bg-gray-500 text-white px-4 py-2 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                              <span className="font-black">없음</span>
                            </div>
                          ) : (
                            filteredPushes.map((p, idx) => (
                              <div
                                key={idx}
                                className={`px-3 py-2 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform ${idx % 2 === 0 ? 'rotate-1' : '-rotate-1'} ${p.count > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                              >
                                <span className="text-white font-black text-lg drop-shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
                                  {p.racerId}번 {p.count > 0 ? '+' : ''}{p.count}칸
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 트랙 번호 - 크고 진하게 */}
              <div className="flex h-10 border-b-4 border-black bg-yellow-50">
                <div className="w-20 flex-shrink-0"></div>
                {/* 1-19번 칸 */}
                <div className="flex-[19] flex">
                  {Array.from({ length: 19 }, (_, i) => (
                    <div key={i} className="flex-1 flex items-center justify-center text-lg font-black text-black border-r border-black/30">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* 20번 결승선 */}
                <div className="flex-1 flex items-center justify-center text-lg font-black text-black bg-black/10 border-l-2 border-black">
                  20
                </div>
                {/* 절벽 */}
                <div className="w-28 flex-shrink-0 bg-black/40 flex items-center justify-center">
                  <span className="text-sm font-black text-white drop-shadow-lg">CLIFF</span>
                </div>
              </div>

              {/* 레이서 트랙 + 결승선 + 절벽 통합 영역 */}
              <div className="flex-1 flex border-4 border-black border-t-0">
                {/* 트랙 영역 (1-19번 칸) */}
                <div className="flex-[19] flex flex-col">
                  {racers.map(racer => {
                    // 현재 공개된 팀의 이 레이서에 대한 푸시 찾기
                    const revealingTeam = revealState.currentRevealingTeamId
                      ? teams.find(t => t.id === revealState.currentRevealingTeamId)
                      : null;
                    const currentPush = revealingTeam?.currentRoundPushes?.find(p => p.racerId === racer.id);

                    return (
                      <div key={racer.id} className="flex-1 flex border-b border-black last:border-b-0 min-h-[60px]">
                        {/* 트랙 번호 라벨 */}
                        <div className="w-20 bg-black flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-white font-black text-[8px] leading-none">TRK</span>
                          <span className="text-white font-black text-2xl leading-none">{racer.id}</span>
                        </div>

                        {/* 19칸 그리드 (1-19번) */}
                        <div className="flex-1 flex relative">
                          {Array.from({ length: 19 }, (_, i) => (
                            <div
                              key={i}
                              className="flex-1 border-r border-black/30"
                            ></div>
                          ))}

                          {/* 자동차 + 푸시 표시 */}
                          <div
                            className="absolute inset-y-0 transition-all duration-1000 ease-in-out flex items-center z-10"
                            style={{
                              // 각 칸의 중앙에 정확하게 위치시키기: 19칸 기준으로 계산
                              left: racer.position > 20 ? '110%' : racer.position === 20 ? '105%' : racer.position <= 0 ? '0%' : `${((racer.position - 0.5) / 19) * 100}%`,
                              transform: `translateX(-50%) ${racer.isEliminated && racer.position > 20 ? 'rotate(90deg) translateY(100px)' : racer.isEliminated ? 'rotate(45deg) scale(0.6)' : ''}`,
                              opacity: racer.isEliminated && racer.position > 20 ? 0 : racer.isEliminated ? 0.3 : 1
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {/* 마이너스 표시 (왼쪽) - 브루탈리즘 3D 스타일 */}
                              {currentPush && currentPush.count < 0 && (
                                <div className="relative animate-bounce">
                                  <div className="bg-blue-500 text-white px-3 py-1 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transform -rotate-6">
                                    <span className="font-black text-xl drop-shadow-[1px_1px_0px_rgba(0,0,0,0.8)]">{currentPush.count}</span>
                                  </div>
                                  {/* 화살표 */}
                                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[10px] border-l-blue-500"></div>
                                </div>
                              )}

                              {/* 자동차 이미지 - 2배 크기 */}
                              <RacerCarImage racerId={racer.id} size={88} />

                              {/* 플러스 표시 (오른쪽) - 브루탈리즘 3D 스타일 */}
                              {currentPush && currentPush.count > 0 && (
                                <div className="relative animate-bounce">
                                  {/* 화살표 */}
                                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-red-500"></div>
                                  <div className="bg-red-500 text-white px-3 py-1 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transform rotate-6">
                                    <span className="font-black text-xl drop-shadow-[1px_1px_0px_rgba(0,0,0,0.8)]">+{currentPush.count}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 결승선 영역 (20번 칸) - 하나의 통합 체크무늬 */}
                <div className="flex-1 relative overflow-hidden border-l-2 border-black checkered-finish">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white font-black text-sm drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]">FINISH</span>
                  </div>
                </div>

                {/* 절벽 영역 - 하나의 통합 이미지 */}
                <div className="w-28 relative overflow-hidden flex-shrink-0 border-l-4 border-black">
                  <img src={CLIFF_IMAGE} alt="Cliff" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30"></div>
                </div>
              </div>
            </div>

            {/* 컨트롤 패널 (인라인 또는 별도 창) */}
            <Relocatable
              popped={showControlPopup}
              onClose={() => setShowControlPopup(false)}
              title="AI SURVIVAL RACING — 컨트롤 패널"
              inlineClass="grid grid-cols-3 gap-3 h-[200px]"
              poppedClass="grid grid-cols-3 gap-4 p-4 min-h-screen bg-slate-100 auto-rows-fr"
              placeholder={
                <div className="brutal-card bg-white p-3 flex items-center justify-center gap-3 text-center">
                  <span className="text-2xl">🖥</span>
                  <div className="flex flex-col">
                    <p className="font-black text-sm">컨트롤 패널이 별도 창에서 열려 있습니다</p>
                    <p className="text-[11px] text-black/60 font-bold">별도 창(듀얼 모니터)에서 조작하세요. 창을 닫으면 여기로 돌아옵니다.</p>
                  </div>
                  <button onClick={() => setShowControlPopup(false)} className="brutal-btn px-3 py-2 bg-gray-700 text-white text-xs font-black">
                    여기로 되돌리기
                  </button>
                </div>
              }
            >
              {/* 1. 게임 진행 */}
              <section className="brutal-card bg-blue-300 p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-black text-sm">1</span>
                  <h3 className="font-black text-sm uppercase">게임 진행</h3>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  {gameState.status === 'LOBBY' && (
                    <>
                      {/* 스폰서십 제출 현황 */}
                      <div className="bg-white/60 p-1.5 rounded border-2 border-black">
                        <p className="text-[9px] font-black text-black/60 mb-1 uppercase">스폰서십 제출 현황</p>
                        <div className="grid grid-cols-4 gap-1">
                          {Array.from({ length: gameState.maxTeams }, (_, i) => {
                            const teamIndex = i + 1;
                            const team = teams.find(t => t.index === teamIndex);
                            const hasSponsorship = team && team.sponsorships && team.sponsorships.length >= 3;
                            return (
                              <div
                                key={teamIndex}
                                className={`text-center py-0.5 rounded text-[9px] font-black border ${
                                  hasSponsorship
                                    ? 'bg-green-500 text-white border-green-700'
                                    : team
                                      ? 'bg-orange-400 text-white border-orange-600'
                                      : 'bg-gray-200 text-gray-400 border-gray-300'
                                }`}
                              >
                                {teamIndex}조{hasSponsorship && ' ✓'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        onClick={startSponsoring}
                        disabled={!allTeamsSponsorshipSubmitted}
                        className={`brutal-btn py-2 text-white text-sm font-black ${
                          allTeamsSponsorshipSubmitted
                            ? 'bg-purple-500 animate-pulse ring-2 ring-yellow-400'
                            : 'bg-gray-400 cursor-not-allowed opacity-60'
                        }`}
                      >
                        {allTeamsSponsorshipSubmitted ? '✅ 스폰서십 시작' : '💰 스폰서십 (대기)'}
                      </button>
                    </>
                  )}
                  {(gameState.status === 'LOBBY' || gameState.status === 'SPONSORING') && (
                    <button onClick={startMiniGame} className="brutal-btn py-2 bg-orange-500 text-white text-sm font-black">
                      🎮 미니게임 시작
                    </button>
                  )}
                  {gameState.status === 'PUSH_INPUT' && (
                    <button
                      onClick={startRevealing}
                      className={`brutal-btn py-2 text-white text-sm font-black ${allTeamsSubmitted ? 'bg-green-500 animate-pulse ring-4 ring-yellow-400' : 'bg-pink-500'}`}
                    >
                      {allTeamsSubmitted ? '✅ 결과 공개' : '🎯 결과 공개'}
                    </button>
                  )}
                  {gameState.status === 'REVEALING' && (
                    <button onClick={nextRound} className="brutal-btn py-2 bg-black text-white text-sm font-black">
                      ➡️ 다음 라운드
                    </button>
                  )}
                  {gameState.status === 'RESULTS' && (
                    <button onClick={finishGame} className="brutal-btn py-2 bg-red-500 text-white text-sm font-black">
                      🏁 게임 종료
                    </button>
                  )}
                  {gameState.status === 'FINISHED' && (
                    <button onClick={() => { setShowTeamResults(true); }} className="brutal-btn py-2 bg-yellow-500 text-black text-sm font-black">
                      🏆 결과 보기
                    </button>
                  )}
                </div>
              </section>

              {/* 2. 라운드 설정 + 3. 미니게임 순위 (합침) */}
              <section className="brutal-card bg-cyan-300 p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-black text-sm">2</span>
                  <h3 className="font-black text-sm uppercase">라운드 설정</h3>
                </div>
                {/* 라운드 설정 */}
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black block mb-0.5">1등 PUSH</label>
                    <input type="number" className="brutal-input text-sm w-full font-black p-1" value={totalPushInput === 0 ? '' : totalPushInput} onChange={(e) => setTotalPushInput(e.target.value === '' ? 0 : parseInt(e.target.value))} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black block mb-0.5">시간(분)</label>
                    <input type="number" className="brutal-input text-sm w-full font-black p-1" value={timerMinutes === 0 ? '' : timerMinutes} onChange={(e) => setTimerMinutes(e.target.value === '' ? 0 : parseInt(e.target.value))} />
                  </div>
                </div>
                {/* 미니게임 순위 - 병렬 구조 */}
                <div className="flex-1 bg-lime-400 rounded border-2 border-black p-2 overflow-y-auto">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-5 h-5 bg-black text-white rounded-full flex items-center justify-center font-black text-[10px]">3</span>
                    <span className="font-black text-[10px] uppercase">미니게임 순위</span>
                    <button onClick={handleRunAllocation} className="ml-auto brutal-btn px-2 py-0.5 bg-white text-[10px] font-black">
                      📊 배분
                    </button>
                  </div>
                  {teams.length === 0 ? (
                    <div className="text-center text-[10px] text-black/50 font-bold">등록된 팀 없음</div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {teams
                        .sort((a, b) => (a.index || 0) - (b.index || 0))
                        .map((team) => (
                          <div key={team.id} className="bg-white/70 p-1.5 border border-black rounded flex flex-col items-center">
                            <span className="text-[10px] font-black">{team.index}조</span>
                            <input
                              type="number"
                              min="1"
                              max={teams.length}
                              placeholder="#"
                              className="w-11 h-7 border-2 border-black text-center text-sm font-black bg-white"
                              value={teamRanks[team.id] || ''}
                              onChange={(e) => setTeamRanks({ ...teamRanks, [team.id]: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                            />
                            {pendingAllocations[team.id] !== undefined && (
                              <div className="flex items-center">
                                <span className="text-[10px] font-black text-green-700">P:</span>
                                <input
                                  type="number"
                                  min="1"
                                  className="w-12 border border-green-700 text-center text-[10px] font-black text-green-700 bg-white/50"
                                  value={pendingAllocations[team.id] === 0 ? '' : pendingAllocations[team.id]}
                                  onChange={(e) => setPendingAllocations({ ...pendingAllocations, [team.id]: e.target.value === '' ? 0 : Math.max(parseInt(e.target.value), 0) })}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 4. 팀별 PUSH 공개 */}
              <section className="brutal-card bg-orange-400 p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-black text-sm">4</span>
                  <h3 className="font-black text-sm uppercase">팀별 PUSH 공개</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {teams.map(team => {
                    const isRevealed = revealState.revealedTeamIds?.includes(team.id);
                    const currentPushes = team.currentRoundPushes || [];
                    const pushSummary = currentPushes.map(p => `${p.racerId}번:${p.count > 0 ? '+' : ''}${p.count}`).join(', ');

                    return (
                      <div key={team.id} className={`p-1.5 border-2 border-black flex justify-between items-center text-xs ${isRevealed ? 'bg-green-200' : team.hasSubmittedPushes ? 'bg-yellow-100' : 'bg-white'}`}>
                        <div className="flex flex-col min-w-0">
                          <span className="font-black truncate">
                            {team.index}조 {team.name}
                            {(team.totalPushAllowance > 0 || pendingAllocations[team.id] !== undefined) && (
                              <span className="text-green-700 ml-1">
                                P:{team.totalPushAllowance > 0 ? team.totalPushAllowance : pendingAllocations[team.id]}
                              </span>
                            )}
                          </span>
                          {team.hasSubmittedPushes && (
                            <span className="text-[9px] text-black/60 truncate">{pushSummary || '없음'}</span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {gameState.status === 'REVEALING' && !isRevealed && (
                            <button
                              onClick={() => revealTeam(team.id)}
                              disabled={revealingTeamId === team.id}
                              className={`text-xs font-black px-3 py-1.5 text-white ${
                                revealingTeamId === team.id
                                  ? 'bg-gray-400 cursor-not-allowed'
                                  : 'bg-pink-500 hover:bg-pink-600'
                              }`}
                            >
                              {revealingTeamId === team.id ? '공개중...' : '공개'}
                            </button>
                          )}
                          {isRevealed && (
                            <button onClick={() => showTeamResultAgain(team.id)} className="text-xs font-black px-3 py-1.5 bg-blue-500 text-white">
                              다시보기
                            </button>
                          )}
                          {team.hasSubmittedPushes && (
                            <span className="text-[10px] font-black px-2 py-1 bg-green-500 text-white">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {gameState.status === 'MINI_GAME' && (
                  <button onClick={handlePushToTeams} className="brutal-btn w-full py-2 bg-yellow-400 text-xs font-black mt-1">📤 PUSH 전송</button>
                )}
              </section>
            </Relocatable>
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

      {/* 스폰서십 검증 화면 */}
      {showSponsorshipVerify && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-auto p-8">
          <div className="brutal-card bg-white p-8 max-w-4xl w-full">
            <h1 className="text-3xl font-black text-center mb-6">📋 스폰서십 검증</h1>
            <p className="text-center text-gray-600 mb-6">최종 결과 공개 전, 모든 팀의 스폰서십 데이터를 확인하세요.</p>

            {/* 팀별 스폰서십 목록 */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {teams
                .sort((a, b) => (a.index || 0) - (b.index || 0))
                .map(team => {
                  const hasSponsorship = team.sponsorships && team.sponsorships.length >= 3;
                  const isEditing = editingTeamId === team.id;

                  return (
                    <div key={team.id} className={`p-4 border-4 ${hasSponsorship ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-xl">{team.index}조</span>
                          <span className="font-bold">{team.name}</span>
                          {!hasSponsorship && (
                            <span className="text-red-600 font-black text-sm bg-red-200 px-2 py-1 rounded">⚠️ 스폰 없음</span>
                          )}
                        </div>
                        <button
                          onClick={() => startEditSponsorship(team)}
                          className="brutal-btn px-3 py-2 bg-blue-500 text-white text-sm font-black flex items-center gap-1"
                        >
                          ✏️ 수정
                        </button>
                      </div>

                      {/* 스폰서십 내용 */}
                      <div className="mt-2 text-sm">
                        {hasSponsorship ? (
                          <span className="text-green-700 font-bold">
                            스폰: {team.sponsorships?.map(s => `${s.racerId}번(${s.amount}천만)`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold">스폰서십 데이터가 없습니다</span>
                        )}
                      </div>

                      {/* 수정 폼 */}
                      {isEditing && (
                        <div className="mt-4 p-4 bg-white border-2 border-black rounded">
                          <h4 className="font-black mb-3">스폰서십 수정</h4>
                          <div className="space-y-2">
                            {editingSponsorships.map((sponsor, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <span className="w-16 font-bold text-sm">스폰 {idx + 1}:</span>
                                <select
                                  className="border-2 border-black p-1 font-bold"
                                  value={sponsor.racerId}
                                  onChange={(e) => {
                                    const newSponsorships = [...editingSponsorships];
                                    newSponsorships[idx].racerId = e.target.value;
                                    setEditingSponsorships(newSponsorships);
                                  }}
                                >
                                  {[1,2,3,4,5,6,7,8].map(n => (
                                    <option key={n} value={String(n)}>{n}번 레이서</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  className="w-16 border-2 border-black p-1 text-center font-bold"
                                  value={sponsor.amount}
                                  onChange={(e) => {
                                    const newSponsorships = [...editingSponsorships];
                                    newSponsorships[idx].amount = parseInt(e.target.value) || 1;
                                    setEditingSponsorships(newSponsorships);
                                  }}
                                />
                                <span className="text-sm font-bold">천만원</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button onClick={saveEditSponsorship} className="brutal-btn px-4 py-2 bg-green-500 text-white text-sm font-black">
                              ✓ 저장
                            </button>
                            <button onClick={cancelEditSponsorship} className="brutal-btn px-4 py-2 bg-gray-400 text-white text-sm font-black">
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowSponsorshipVerify(false)}
                className="brutal-btn flex-1 py-4 bg-gray-400 text-white text-xl font-black"
              >
                ← 돌아가기
              </button>
              <button
                onClick={proceedToResults}
                className="brutal-btn flex-1 py-4 bg-green-500 text-white text-xl font-black animate-pulse"
              >
                ✅ 검증 완료 - 결과 보기
              </button>
            </div>
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
                {(() => {
                  const sorted = [...racers].sort((a, b) => {
                    if (a.isEliminated && !b.isEliminated) return 1;
                    if (!a.isEliminated && b.isEliminated) return -1;
                    return b.position - a.position;
                  });
                  const ranks = getRacerRanks(sorted);
                  return sorted.map((racer, idx) => (
                    <div key={racer.id} className={`p-4 border-4 border-black text-center ${racer.isEliminated ? 'bg-gray-300 opacity-50' : ranks[idx] === 1 ? 'bg-yellow-400' : 'bg-white'}`}>
                      <div className="text-3xl font-black">{racer.isEliminated ? '💀' : `${ranks[idx]}등`}</div>
                      <div className="flex justify-center my-2">
                        <RacerCarImage racerId={racer.id} size={56} />
                      </div>
                      <div className="font-black">{racer.id}번 레이서</div>
                      <div className="text-sm text-black/60">위치: {racer.position}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <button onClick={() => { playCelebrationSound(); setShowTeamResults(true); }} className="brutal-btn w-full mt-8 py-6 bg-yellow-400 text-black text-2xl font-black animate-pulse">
              🏆 최종 순위 결과 보기 🏆
            </button>
          </div>
        </div>
      )}

      {/* 최종 결과 화면 - 팀 수익 (2단계) */}
      {(gameState.status === 'RESULTS' || gameState.status === 'FINISHED') && showTeamResults && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-auto p-8">
          <div className="brutal-card bg-white p-8 max-w-5xl w-full">
            {/* 다운로드 대상 영역 */}
            <div ref={resultsRef} className="bg-white p-8">
              <h1 className="text-5xl font-black text-center mb-4">🏆 최종 순위 결과 🏆</h1>
              <p className="text-center text-xl font-black text-black/50 mb-8">{gameState.courseName}</p>

              {/* 레이서 최종 순위 - 다운로드 캡처 시에만 표시 */}
              {isCapturing && (
                <div className="mb-8">
                  <h2 className="text-2xl font-black mb-4 border-b-4 border-black pb-2">레이서 최종 순위</h2>
                  <div className="grid grid-cols-4 gap-3">
                    {(() => {
                      const sorted = [...racers].sort((a, b) => {
                        if (a.isEliminated && !b.isEliminated) return 1;
                        if (!a.isEliminated && b.isEliminated) return -1;
                        return b.position - a.position;
                      });
                      const ranks = getRacerRanks(sorted);
                      return sorted.map((racer, idx) => (
                        <div key={racer.id} className={`p-3 border-4 border-black text-center ${racer.isEliminated ? 'bg-gray-300 opacity-50' : ranks[idx] === 1 ? 'bg-yellow-400' : 'bg-white'}`}>
                          <div className="text-2xl font-black">{racer.isEliminated ? '💀' : `${ranks[idx]}등`}</div>
                          <div className="flex justify-center my-1">
                            <RacerCarImage racerId={String(racer.id)} size={48} />
                          </div>
                          <div className="font-black text-sm">{racer.id}번 레이서</div>
                          <div className="text-xs text-black/60">위치: {racer.position}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* 팀 수익 순위 */}
              <h2 className="text-2xl font-black mb-4 border-b-4 border-black pb-2">팀 최종 순위</h2>
              <div className="space-y-5">
                {(() => {
                  const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints);
                  const teamRankNumbers: number[] = [];
                  for (let i = 0; i < sorted.length; i++) {
                    if (i === 0 || sorted[i].totalPoints !== sorted[i - 1].totalPoints) {
                      teamRankNumbers.push(i + 1);
                    } else {
                      teamRankNumbers.push(teamRankNumbers[i - 1]);
                    }
                  }
                  return sorted.map((team, idx) => (
                    <div key={team.id} className={`p-6 border-4 border-black ${teamRankNumbers[idx] === 1 ? 'bg-yellow-400 scale-[1.02]' : 'bg-white'}`}>
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-6 min-w-0">
                          <span className="font-black text-5xl whitespace-nowrap">{teamRankNumbers[idx]}등</span>
                          <div className="min-w-0">
                            <span className="font-black text-5xl block">{team.index}조 {team.name}</span>
                            <div className="text-lg font-bold text-black/70 mt-1">
                              {(team.members || []).map(m => `${m.name}(${m.role})`).join(', ') || '팀원 정보 없음'}
                            </div>
                            <div className="text-xl font-black text-black mt-2">
                              스폰: {(team.sponsorships || []).map(s => `${s.racerId}번(${s.amount}천만)`).join(', ') || '없음'}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="font-black text-5xl text-green-600 whitespace-nowrap">
                            {formatKoreanMoney(team.totalPoints)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 다운로드 버튼 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleDownloadPNG}
                disabled={isDownloading}
                className="brutal-btn flex-1 py-3 bg-blue-500 text-white text-lg font-black"
              >
                {isDownloading ? '다운로드 중...' : '📷 PNG 다운로드'}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="brutal-btn flex-1 py-3 bg-red-500 text-white text-lg font-black"
              >
                {isDownloading ? '다운로드 중...' : '📄 PDF 다운로드'}
              </button>
            </div>

            <div className="flex gap-4 mt-4">
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
