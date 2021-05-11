

export enum State {
  Flowing = 'flowing',
  Completing = 'completing',
  Complete = 'complete',
  Errored = 'errrored'
}

export namespace State {
  export const isFlowing = (state: State): state is State.Flowing => state === State.Flowing;
  export const isCompleting = (state: State): state is State.Completing => state === State.Completing;
}