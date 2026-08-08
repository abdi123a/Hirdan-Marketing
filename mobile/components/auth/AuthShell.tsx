import React, { useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../ui/Text';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { brand, fontSize } from '../../constants/theme';
import { ease, spring, stagger } from '../../constants/motion';
import { Reveal } from './Reveal';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HERO_RATIO = 0.6;
/** How far the card rides up into the brand band. */
const CARD_OVERLAP = 84;

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  /** Increment to shake the card, e.g. after a rejected submission. */
  shakeToken?: number;
  /** Gap kept between the focused field and the keyboard. */
  bottomOffset?: number;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  onBack,
  shakeToken = 0,
  bottomOffset = 88,
}: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const compact = height < 780;

  const heroHeight = Math.round(height * HERO_RATIO);
  const heroPaddingTop = insets.top + (compact ? 20 : 32);
  const collapseDistance = Math.max(heroHeight * 0.45, 140);

  const scrollY = useSharedValue(0);
  const cardEnter = useSharedValue(0);
  const shake = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useEffect(() => {
    cardEnter.value = withDelay(stagger.card, withSpring(1, spring.gentle));
  }, [cardEnter]);

  useEffect(() => {
    if (shakeToken === 0) return;
    shake.value = withSequence(
      withTiming(-9, { duration: 55, easing: ease.out }),
      withTiming(9, { duration: 70 }),
      withTiming(-5, { duration: 65 }),
      withTiming(0, { duration: 60 }),
    );
  }, [shakeToken, shake]);

  // The hero copy dissolves as it slides under the status bar instead of being
  // clipped by it, and lags the scroll slightly so the band feels deeper.
  const heroCopyStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, collapseDistance],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const shift = reduceMotion ? 0 : progress;
    return {
      opacity: 1 - progress,
      transform: [{ translateY: shift * 30 }, { scale: 1 - shift * 0.05 }],
    };
  });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardEnter.value,
    transform: [
      { translateY: reduceMotion ? 0 : (1 - cardEnter.value) * 26 },
      { translateX: shake.value },
    ],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <KeyboardAwareScrollView
        onScroll={onScroll}
        contentContainerStyle={[
          styles.content,
          { minHeight: height, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        bottomOffset={bottomOffset}
      >
        <View
          style={[
            styles.hero,
            {
              minHeight: heroHeight,
              paddingTop: heroPaddingTop,
              // Matching the top inset plus the overlap optically centres the
              // brand block inside the purple that stays visible.
              paddingBottom: heroPaddingTop + CARD_OVERLAP,
            },
          ]}
        >
          <Animated.View style={[styles.heroCopy, heroCopyStyle]}>
            <Reveal delay={stagger.logo} distance={12}>
              <Image
                source={require('../../assets/logo-wordmark-white.png')}
                style={[styles.logo, compact && styles.logoCompact]}
                resizeMode="contain"
                accessibilityLabel="Hirdan Marketing"
              />
            </Reveal>

            <Reveal delay={stagger.headline} distance={12}>
              <Text style={[styles.headline, compact && styles.headlineCompact]}>{title}</Text>
            </Reveal>

            <Reveal delay={stagger.subhead} distance={12}>
              <Text style={styles.subhead}>{subtitle}</Text>
            </Reveal>
          </Animated.View>
        </View>

        <View style={styles.cardWrap}>
          <Animated.View style={[styles.card, compact && styles.cardCompact, cardStyle]}>
            {children}
          </Animated.View>
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAwareScrollView>

      {/* Keeps the status bar legible once the white card scrolls up under it. */}
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />

      {onBack ? <BackButton onPress={onBack} top={insets.top + 6} /> : null}
    </View>
  );
}

function BackButton({ onPress, top }: { onPress: () => void; top: number }) {
  const press = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.9]) }],
    backgroundColor: `rgba(255, 255, 255, ${interpolate(press.value, [0, 1], [0.14, 0.28])})`,
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      onPressIn={() => {
        press.value = withSpring(1, spring.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, spring.press);
      }}
      onPress={onPress}
      style={[styles.backBtn, { top }, animatedStyle]}
    >
      <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F1F7',
  },
  content: {
    flexGrow: 1,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: brand.purple,
  },
  hero: {
    backgroundColor: brand.purple,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  heroCopy: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 200,
    height: 76,
  },
  logoCompact: {
    width: 168,
    height: 64,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  headlineCompact: {
    fontSize: 26,
    lineHeight: 32,
  },
  subhead: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: fontSize.sm,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 290,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 20,
    marginTop: -CARD_OVERLAP,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
    gap: 16,
  },
  cardCompact: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    gap: 13,
  },
  footer: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    position: 'absolute',
    left: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
