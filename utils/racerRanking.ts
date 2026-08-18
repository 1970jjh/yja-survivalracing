// 레이서 최종 순위/스폰 수익 배수 계산 (단일 소스)
//
// 규칙:
//  - 도착지점은 20번째 칸. 20칸을 "넘어서" 절벽으로 추락한 레이서(position > 20,
//    또는 isEliminated 플래그)는 최종 순위에서 제외되고 스폰 수익은 0원.
//  - 추락하지 않은(생존) 레이서는 20칸에 "가장 가까운"(= position이 큰) 순서대로
//    1등, 2등, ... 이고, position이 같으면 공동순위.
//  - 스폰 수익 배수: 1등 ×8, 2등 ×7, 3등 ×6, 4등 ×5, 5등 ×4, 6등 ×3, 7등 ×2, 8등 ×1.
//    공동순위는 동일 배수(예: 공동 1등이면 둘 다 ×8, 다음은 3등 ×6).

export interface RacerLike {
  id: number;
  position: number;
  isEliminated?: boolean;
}

// 절벽 추락 여부 (도착지점 20칸 초과 또는 탈락 플래그)
export const isFallen = (r: { position: number; isEliminated?: boolean }): boolean =>
  !!r.isEliminated || r.position > 20;

// 정렬된 레이서 배열에서 각 인덱스의 공동순위(1-based)를 반환. 추락 레이서는 -1.
// 입력은 "생존 우선 + position 내림차순"으로 정렬되어 있다고 가정.
export const getRacerRanks = (sortedRacers: { position: number; isEliminated?: boolean }[]): number[] => {
  const ranks: number[] = [];
  let i = 0;
  while (i < sortedRacers.length) {
    if (isFallen(sortedRacers[i])) {
      ranks.push(-1); // 추락 (수익 0)
      i++;
      continue;
    }
    let j = i;
    while (
      j < sortedRacers.length &&
      !isFallen(sortedRacers[j]) &&
      sortedRacers[j].position === sortedRacers[i].position
    ) {
      j++;
    }
    for (let k = i; k < j; k++) {
      ranks.push(i + 1); // 공동순위는 동일 순위
    }
    i = j;
  }
  return ranks;
};

// 결과 화면 정렬 비교자: 생존 레이서 우선, 그 안에서는 20칸에 가까운(=position 큰) 순.
export const compareForRanking = (
  a: { position: number; isEliminated?: boolean },
  b: { position: number; isEliminated?: boolean }
): number => {
  if (isFallen(a) && !isFallen(b)) return 1;
  if (!isFallen(a) && isFallen(b)) return -1;
  return b.position - a.position;
};

// racerId → 스폰 수익 배수 맵. 생존 레이서만 키를 가지며(1등 ×8 ... 8등 ×1),
// 추락 레이서는 키가 없으므로 조회 시 0으로 처리하면 된다.
export const computeRacerMultipliers = (racers: RacerLike[]): Record<number, number> => {
  const survivors = racers.filter(r => !isFallen(r)).sort((a, b) => b.position - a.position);
  const mult: Record<number, number> = {};
  let i = 0;
  while (i < survivors.length) {
    let j = i;
    while (j < survivors.length && survivors[j].position === survivors[i].position) j++;
    const multiplier = Math.max(9 - (i + 1), 0); // 순위(i+1)별 배수, 공동순위는 동일
    for (let k = i; k < j; k++) mult[survivors[k].id] = multiplier;
    i = j;
  }
  return mult;
};
