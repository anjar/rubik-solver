declare module 'cubejs' {
  export default class Cube {
    cp: number[]; co: number[]; ep: number[]; eo: number[]; center: number[];
    constructor(other?: Cube);
    static fromString(s: string): Cube;
    static random(): Cube;
    static initSolver(): void;
    static inverse(algorithm: string): string;
    asString(): string;
    move(algorithm: string): Cube;
    solve(maxDepth?: number): string;
    isSolved(): boolean;
  }
}
