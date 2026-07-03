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
    app.innerHTML = `${html}<aside class="build-stamp" aria-label="Current app build code">${__BUILD_ID__}</aside>`;
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
    buildCode: __BUILD_ID__,
    goTo,
    render,
    setAnimationFrame,
  };

  return context;
}
