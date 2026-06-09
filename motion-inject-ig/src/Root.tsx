import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';

export const RemotionVideo: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={7344}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
