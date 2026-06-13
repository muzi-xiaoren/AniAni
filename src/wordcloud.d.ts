declare module "wordcloud" {
  export interface WordCloudOptions {
    list: [string, number][];
    fontFamily?: string;
    fontWeight?: string | number;
    color?:
      | string
      | ((word: string, weight: number, fontSize: number, distance: number, theta: number) => string);
    backgroundColor?: string;
    gridSize?: number;
    weightFactor?: number | ((weight: number) => number);
    minSize?: number;
    rotateRatio?: number;
    rotationSteps?: number;
    minRotation?: number;
    maxRotation?: number;
    shape?: string | ((theta: number) => number);
    ellipticity?: number;
    drawOutOfBound?: boolean;
    shrinkToFit?: boolean;
    origin?: [number, number];
    clearCanvas?: boolean;
    wait?: number;
    abortThreshold?: number;
  }
  interface WordCloudStatic {
    (canvas: HTMLElement | HTMLElement[], options?: WordCloudOptions): void;
    isSupported: boolean;
    minFontSize: number;
    stop(): void;
  }
  const WordCloud: WordCloudStatic;
  export default WordCloud;
}
