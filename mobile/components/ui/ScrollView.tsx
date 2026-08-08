import React from 'react';
import {
  ScrollView as RNScrollView,
  StyleSheet,
  type ScrollViewProps as RNScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScrollViewProps extends RNScrollViewProps {
  /**
   * Opt out of the automatic bottom inset — for a scroll view whose parent
   * already reserves that space (a sheet, or a screen with a pinned ActionBar).
   */
  ignoreBottomInset?: boolean;
}

/**
 * ScrollView that keeps its last row clear of the system navigation area.
 *
 * On a pushed screen there is no tab bar underneath, so content runs to the
 * very bottom edge of the display and the final control ends up sitting under
 * Android's back/home buttons or the gesture handle. Reserving the inset is
 * something every such screen needs, so it belongs here rather than being
 * re-derived (and forgotten) per screen.
 *
 * The inset is *added* to whatever padding the caller set, so existing spacing
 * is preserved rather than replaced. Horizontal scrollers are left alone —
 * bottom padding there just adds dead space.
 */
export const ScrollView = React.forwardRef<RNScrollView, ScrollViewProps>(
  function ScrollView(
    { contentContainerStyle, horizontal, ignoreBottomInset, ...rest },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const skip = horizontal || ignoreBottomInset || insets.bottom === 0;

    const style = React.useMemo(() => {
      if (skip) return contentContainerStyle;
      const flat = StyleSheet.flatten(contentContainerStyle) as ViewStyle | undefined;
      const existing =
        typeof flat?.paddingBottom === 'number'
          ? flat.paddingBottom
          : typeof flat?.padding === 'number'
            ? flat.padding
            : 0;
      return [contentContainerStyle, { paddingBottom: existing + insets.bottom }];
    }, [contentContainerStyle, insets.bottom, skip]);

    return (
      <RNScrollView
        ref={ref}
        horizontal={horizontal}
        contentContainerStyle={style}
        {...rest}
      />
    );
  },
);
