import type { ResponseItem, SetView } from '@picklab/shared';

/** Every view takes the same props, so the layout is the only difference between them. */
export type ViewProps = {
  set: SetView;
  /** Called once per set with the final responses. */
  onAnswer: (responses: ResponseItem[]) => void;
};
