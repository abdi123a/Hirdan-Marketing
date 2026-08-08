import React, { Suspense, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useLocalSearchParams, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch, getFullUrl } from '../../../lib/api-client';
import { unwrapList } from '../../../lib/format';
import { normalizeTransfer, previewKindOf, statusOf } from '../../../lib/transfers';
import { EmptyState, MediaSkeleton, Skeleton } from '../../../components/ui';
import { spacing, fontSize, radius } from '../../../constants/theme';

// Both viewers pull in native modules, so they load lazily and any failure is contained by
// the ErrorBoundary below instead of making this route unloadable.
const VideoPlayer = React.lazy(() => import('../../../components/TransferVideoPlayer'));
const PdfViewer = React.lazy(() =>
  import('react-native-webview').then((m) => ({ default: m.WebView }))
);

export default function TransferPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  const listQ = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.transfer.list);
      return unwrapList<Record<string, any>>(res).map(normalizeTransfer);
    },
  });

  const transfer = useMemo(
    () => (listQ.data ?? []).find((x) => x.id === id),
    [listQ.data, id]
  );

  const kind = transfer ? previewKindOf(transfer.fileName) : null;
  const isActive = transfer ? statusOf(transfer) === 'active' && !transfer.isDeleted : false;
  // Android's WebView has no PDF renderer, so PDFs are handed to the OS from the detail
  // screen and only reach this route on iOS.
  const canRender = kind === 'pdf' ? Platform.OS === 'ios' : !!kind;
  const uri =
    transfer && isActive && canRender
      ? getFullUrl(endpoints.transfer.download(transfer.shareId, true))
      : null;

  if (listQ.isLoading) {
    return <MediaSkeleton />;
  }

  if (!transfer || !uri) {
    return (
      <EmptyState
        title="Nothing to preview"
        description={
          transfer && !isActive
            ? 'This transfer has expired or been revoked.'
            : 'This file type cannot be previewed in the app.'
        }
        actionLabel="Back"
        onAction={() => router.back()}
        icon="eye-off-outline"
      />
    );
  }

  return (
    <View style={styles.stage}>
      <Suspense fallback={null}>
        {kind === 'image' ? (
          <Image
            source={{ uri }}
            style={styles.fill}
            contentFit="contain"
            onLoadEnd={() => setLoaded(true)}
          />
        ) : kind === 'video' ? (
          <VideoPlayer uri={uri} onFirstFrame={() => setLoaded(true)} />
        ) : (
          <PdfViewer
            source={{ uri }}
            style={styles.fill}
            originWhitelist={['http://*', 'https://*']}
            onLoadEnd={() => setLoaded(true)}
          />
        )}
      </Suspense>

      {!loaded ? (
        <View style={styles.overlay} pointerEvents="none">
          <Skeleton height={48} width={48} radius={radius.md} color="#2A2A2A" />
          <Text style={styles.overlayText} numberOfLines={2}>
            Loading {transfer.fileName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <EmptyState
      title="Preview unavailable"
      description={error.message}
      actionLabel="Try again"
      onAction={() => void retry()}
      icon="eye-off-outline"
    />
  );
}

const styles = StyleSheet.create({
  // Media reads best on black regardless of the app's colour scheme.
  stage: { flex: 1, backgroundColor: '#000000' },
  fill: { flex: 1, width: '100%' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.xl,
    textAlign: 'center',
  },
});
