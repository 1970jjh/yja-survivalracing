
import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_PASSWORD } from '../constants';
import { GameState } from '../types';

// 타이머 알람 소리 URL
const TIMER_ALARM_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface AdminSetupProps {
  onCancel: () => void;
  onCreate: (courseName: string, teamCount: number, rounds: number) => void;
  onSelectGame: (game: GameState) => void;
  onDeleteGame: (gameId: string) => void;
  activeGames: GameState[];
}

const AdminSetup: React.FC<AdminSetupProps> = ({ onCancel, onCreate, onSelectGame, onDeleteGame, activeGames }) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [mode, setMode] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [courseName, setCourseName] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const [rounds, setRounds] = useState(3);

  // 퀵 타이머 상태
  const [showQuickTimer, setShowQuickTimer] = useState(false);
  const [quickTimerInputMin, setQuickTimerInputMin] = useState(1);
  const [quickTimerInputSec, setQuickTimerInputSec] = useState(0);
  const [quickTimerRemaining, setQuickTimerRemaining] = useState(0);
  const [quickTimerRunning, setQuickTimerRunning] = useState(false);
  const alarmSoundRef = useRef<HTMLAudioElement | null>(null);

  // 안전한 기본값
  const games = activeGames || [];

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

  // 퀵 타이머 카운트다운
  useEffect(() => {
    if (!quickTimerRunning || quickTimerRemaining <= 0) return;

    const interval = setInterval(() => {
      setQuickTimerRemaining(prev => {
        if (prev <= 1) {
          setQuickTimerRunning(false);
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

  // 타이머 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsUnlocked(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleDeleteGame = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // INP 최적화: 비동기로 confirm 처리
    requestAnimationFrame(() => {
      if (confirm('이 게임을 삭제하시겠습니까?')) {
        onDeleteGame(gameId);
      }
    });
  };

  // 퀵 타이머 팝업 컴포넌트
  const QuickTimerPopup = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-3xl p-8 text-center relative min-w-[400px] shadow-2xl">
        {/* X 버튼 */}
        <button
          onClick={() => { setShowQuickTimer(false); stopAlarmSound(); }}
          className="absolute top-4 right-4 w-10 h-10 bg-black text-white rounded-full font-black text-xl hover:bg-red-500 transition-colors"
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
                className="w-24 text-center text-3xl font-black border-2 border-black rounded-xl p-2"
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
                className="w-24 text-center text-3xl font-black border-2 border-black rounded-xl p-2"
                value={quickTimerInputSec}
                onChange={(e) => setQuickTimerInputSec(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>
        )}

        {/* 프리셋 버튼들 (타이머가 실행 중이 아닐 때만) */}
        {!quickTimerRunning && quickTimerRemaining === 0 && (
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            <button onClick={() => { setQuickTimerInputMin(0); setQuickTimerInputSec(30); }} className="px-4 py-2 bg-gray-200 rounded-xl text-sm font-bold hover:bg-gray-300">30초</button>
            <button onClick={() => { setQuickTimerInputMin(1); setQuickTimerInputSec(0); }} className="px-4 py-2 bg-gray-200 rounded-xl text-sm font-bold hover:bg-gray-300">1분</button>
            <button onClick={() => { setQuickTimerInputMin(2); setQuickTimerInputSec(0); }} className="px-4 py-2 bg-gray-200 rounded-xl text-sm font-bold hover:bg-gray-300">2분</button>
            <button onClick={() => { setQuickTimerInputMin(3); setQuickTimerInputSec(0); }} className="px-4 py-2 bg-gray-200 rounded-xl text-sm font-bold hover:bg-gray-300">3분</button>
            <button onClick={() => { setQuickTimerInputMin(5); setQuickTimerInputSec(0); }} className="px-4 py-2 bg-gray-200 rounded-xl text-sm font-bold hover:bg-gray-300">5분</button>
          </div>
        )}

        {/* 컨트롤 버튼들 */}
        <div className="flex gap-4 justify-center">
          {!quickTimerRunning && quickTimerRemaining === 0 && (
            <button
              onClick={startQuickTimer}
              className="px-8 py-4 bg-green-500 text-white text-xl font-black rounded-xl hover:bg-green-600 transition-colors"
            >
              ▶ START
            </button>
          )}
          {quickTimerRunning && (
            <button
              onClick={stopQuickTimer}
              className="px-8 py-4 bg-red-500 text-white text-xl font-black rounded-xl hover:bg-red-600 transition-colors"
            >
              ⏸ STOP
            </button>
          )}
          {!quickTimerRunning && quickTimerRemaining > 0 && (
            <>
              <button
                onClick={() => setQuickTimerRunning(true)}
                className="px-8 py-4 bg-green-500 text-white text-xl font-black rounded-xl hover:bg-green-600 transition-colors"
              >
                ▶ RESUME
              </button>
              <button
                onClick={resetQuickTimer}
                className="px-8 py-4 bg-gray-500 text-white text-xl font-black rounded-xl hover:bg-gray-600 transition-colors"
              >
                🔄 RESET
              </button>
            </>
          )}
        </div>

        {/* 알람 끄기 버튼 */}
        {quickTimerRemaining === 0 && !quickTimerRunning && (
          <button
            onClick={stopAlarmSound}
            className="mt-4 px-6 py-2 bg-orange-500 text-white text-sm font-black rounded-xl hover:bg-orange-600 transition-colors"
          >
            🔕 알람 정지
          </button>
        )}
      </div>
    </div>
  );

  // 타이머 버튼 컴포넌트
  const TimerButton = () => (
    <button
      onClick={() => setShowQuickTimer(true)}
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all ${
        quickTimerRunning
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-yellow-400 text-black hover:bg-yellow-500'
      }`}
    >
      {quickTimerRunning ? `⏱ ${formatTime(quickTimerRemaining)}` : '⏱ TIMER'}
    </button>
  );

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
        {/* 타이머 알람 소리 */}
        <audio ref={alarmSoundRef} src={TIMER_ALARM_SOUND} preload="auto" loop />

        <TimerButton />
        {showQuickTimer && <QuickTimerPopup />}

        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-center">관리자 모드 진입</h2>
          <input
            type="password"
            placeholder="비밀번호를 입력하세요"
            className="w-full border p-3 rounded-xl mb-4 text-center text-2xl tracking-widest"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold"
            >
              취소
            </button>
            <button
              onClick={handleUnlock}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 기존 게임 선택 화면
  if (mode === 'SELECT') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
        {/* 타이머 알람 소리 */}
        <audio ref={alarmSoundRef} src={TIMER_ALARM_SOUND} preload="auto" loop />

        <TimerButton />
        {showQuickTimer && <QuickTimerPopup />}

        <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <h1 className="text-2xl font-black text-slate-800">관리자 대시보드</h1>
            <p className="text-xs text-slate-400">게임을 선택하거나 새로 만드세요</p>
          </div>

          {/* 기존 게임 목록 */}
          <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto">
            {games.length > 0 ? (
              games.map(game => {
                const teams = game.teams || [];
                return (
                  <div
                    key={game.id}
                    onClick={() => onSelectGame(game)}
                    className="border-2 border-black rounded-xl p-4 bg-white hover:bg-yellow-50 cursor-pointer transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-lg">{game.courseName}</h3>
                        <p className="text-xs text-slate-400">
                          {teams.length}/{game.maxTeams} 팀 • Round {game.currentRound}/{game.totalRounds}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        game.status === 'LOBBY' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDeleteGame(game.id, e)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <span className="text-3xl block mb-2">📭</span>
                <p className="text-sm text-slate-400">생성된 게임이 없습니다</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-bold"
            >
              뒤로가기
            </button>
            <button
              onClick={() => setMode('CREATE')}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold"
            >
              + 새 게임 만들기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 새 게임 만들기 화면
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      {/* 타이머 알람 소리 */}
      <audio ref={alarmSoundRef} src={TIMER_ALARM_SOUND} preload="auto" loop />

      <TimerButton />
      {showQuickTimer && <QuickTimerPopup />}

      <div className="bg-white rounded-3xl p-8 w-full max-w-md text-slate-900 shadow-2xl">
         <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
             <div className="w-10 h-10 border-4 border-blue-500 rounded-lg"></div>
          </div>
          <h2 className="text-sm text-slate-400 font-bold mb-1">JJ CREATIVE 교육연구소</h2>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">게임 생성</h1>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Company / Course Name</label>
            <input
              type="text"
              placeholder="예) 삼성전자 팀빌딩"
              className="w-full border-slate-200 border p-3 rounded-xl"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Team Count (2~30)</label>
            <select
              className="w-full border-slate-200 border p-3 rounded-xl bg-white"
              value={teamCount}
              onChange={(e) => setTeamCount(parseInt(e.target.value))}
            >
              {Array.from({ length: 29 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>{n}개 팀</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Rounds (3~10)</label>
            <select
              className="w-full border-slate-200 border p-3 rounded-xl bg-white"
              value={rounds}
              onChange={(e) => setRounds(parseInt(e.target.value))}
            >
              {Array.from({ length: 8 }, (_, i) => i + 3).map(n => (
                <option key={n} value={n}>{n} 라운드</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('SELECT')}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold"
            >
              뒤로
            </button>
            <button
              onClick={() => onCreate(courseName || '무제 과정', teamCount, rounds)}
              className="flex-1 py-4 bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-200"
            >
              <span>🏁</span> CREATE
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-300">@ All Right Reserved by JJ Creative 교육연구소</p>
        </div>
      </div>
    </div>
  );
};

export default AdminSetup;
