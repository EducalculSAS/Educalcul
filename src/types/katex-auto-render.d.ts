declare module "katex/contrib/auto-render" {
  interface Delimiter {
    left: string;
    right: string;
    display: boolean;
  }
  interface Options {
    delimiters?: Delimiter[];
    throwOnError?: boolean;
    [key: string]: unknown;
  }
  function renderMathInElement(elem: HTMLElement, options?: Options): void;
  export default renderMathInElement;
}
