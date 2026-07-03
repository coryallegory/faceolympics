const BUILD_CODE = 'CAL-COPY-09';

export type Screen = (ctx: NavigationContext) => void | Promise<void>;

export interface NavigationContext {
  readonly app: HTMLDivElement;
  readonly buildCode: string;
  goTo: (screen: Screen) => void;
  render: (html: string) => void;
  setAnimationFrame: (id: number) => void;
}

export function createNavigation(app: HTMLDivElement): NavigationContext {
  let activeAnimationFrame = 0;

  const render = (html: string): void => {
    app.innerHTML = `${html}<aside class="build-stamp" aria-label="Current app build code">${BUILD_CODE}</aside>`;
  };

  const setAnimationFrame = (id: number): void => {
    activeAnimationFrame = id;
  };

  const goTo = (screen: Screen): void => {
    cancelAnimationFrame(activeAnimationFrame);
    activeAnimationFrame = 0;
    void screen(context);
  };

  const context: NavigationContext = {
    app,
    buildCode: BUILD_CODE,
    goTo,
    render,
    setAnimationFrame,
  };

  return context;
}
