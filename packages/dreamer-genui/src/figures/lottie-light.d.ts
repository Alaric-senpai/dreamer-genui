declare module 'lottie-web/build/player/lottie_light' {
  const player: {
    loadAnimation: (params: Record<string, unknown>) => {
      destroy: () => void;
      addEventListener?: (name: string, callback: () => void) => void;
      goToAndStop?: (value: number, isFrame?: boolean) => void;
    };
  };
  export default player;
}
