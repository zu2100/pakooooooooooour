export type Theme = "normal" | "lava" | "sky";

export interface CoursePoint {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  checkpoint?: boolean;
  /** 이 스테이지의 마지막 플랫폼(클리어 지점)인지 여부 */
  stageClear?: boolean;
  /** 게임 전체의 최종 도착 지점인지 여부 */
  goal?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  theme: Theme;
  /** stageClear 플랫폼에 도달했을 때 표시할 메시지 (goal 스테이지는 사용하지 않음) */
  clearMessage?: string;
  points: CoursePoint[];
}

export interface CourseData {
  stages: Stage[];
}

export const DEFAULT_COURSE: CourseData = {
  stages: [
    {
      id: "stage1",
      name: "스테이지 1",
      theme: "normal",
      clearMessage: "스테이지 1 클리어! 용암지대 진입...",
      points: [
        { x: 0, y: 0, z: 0, w: 10, d: 10 },
        { x: 0, y: 1, z: -14, w: 6, d: 6 },
        { x: 7, y: 2.5, z: -24, w: 5, d: 5 },
        { x: 2, y: 4.5, z: -34, w: 5, d: 5, checkpoint: true },
        { x: -7, y: 6, z: -42, w: 5, d: 5 },
        { x: -9, y: 7.2, z: -48, w: 4, d: 4 },
        { x: -10, y: 8.5, z: -54, w: 5, d: 5 },
        { x: -2, y: 10.5, z: -64, w: 5, d: 5, checkpoint: true },
        { x: 8, y: 12.5, z: -72, w: 5, d: 5 },
        { x: 16, y: 14.5, z: -80, w: 5, d: 5 },
        { x: 18, y: 17, z: -92, w: 5, d: 5, checkpoint: true },
        { x: 10, y: 19, z: -102, w: 5, d: 5 },
        { x: 0, y: 21, z: -110, w: 5, d: 5 },
        { x: -8, y: 23.5, z: -118, w: 6, d: 6, checkpoint: true },
        { x: -8, y: 25, z: -130, w: 12, d: 12, stageClear: true },
      ],
    },
    {
      id: "stage2",
      name: "스테이지 2 (용암지대)",
      theme: "lava",
      clearMessage: "스테이지 2 클리어! 구름 위 하늘길 진입...",
      points: [
        { x: -8, y: 25, z: -145, w: 6, d: 6 },
        { x: 2, y: 23, z: -156, w: 5, d: 5 },
        { x: 10, y: 21, z: -166, w: 5, d: 5, checkpoint: true },
        { x: 6, y: 19, z: -178, w: 5, d: 5 },
        { x: -4, y: 18, z: -188, w: 5, d: 5 },
        { x: -12, y: 17, z: -198, w: 5, d: 5, checkpoint: true },
        { x: -6, y: 16, z: -210, w: 5, d: 5 },
        { x: 4, y: 15, z: -220, w: 5, d: 5 },
        { x: 12, y: 15, z: -232, w: 5, d: 5, checkpoint: true },
        { x: 6, y: 16, z: -244, w: 5, d: 5 },
        { x: -4, y: 18, z: -254, w: 6, d: 6 },
        { x: -4, y: 20, z: -266, w: 14, d: 14, stageClear: true },
      ],
    },
    {
      id: "stage3",
      name: "스테이지 3 (하늘길)",
      theme: "sky",
      points: [
        { x: 4, y: 22, z: -278, w: 5, d: 5 },
        { x: 12, y: 24, z: -288, w: 5, d: 5, checkpoint: true },
        { x: 6, y: 27, z: -298, w: 5, d: 5 },
        { x: -4, y: 30, z: -308, w: 5, d: 5 },
        { x: -14, y: 33, z: -318, w: 5, d: 5, checkpoint: true },
        { x: -6, y: 36, z: -328, w: 5, d: 5 },
        { x: 4, y: 39, z: -338, w: 5, d: 5 },
        { x: 0, y: 42, z: -350, w: 6, d: 6, checkpoint: true },
        { x: 0, y: 44, z: -362, w: 14, d: 14, goal: true },
      ],
    },
  ],
};
