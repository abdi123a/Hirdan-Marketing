import React from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Kept in its own module so the preview route can load it lazily: `expo-video` resolves its
 * native module at import time and would otherwise make the whole route unloadable on a
 * build that predates the dependency.
 */
export default function TransferVideoPlayer({
  uri,
  onFirstFrame,
}: {
  uri: string;
  onFirstFrame: () => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.fill}
      contentFit="contain"
      onFirstFrameRender={onFirstFrame}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
});
