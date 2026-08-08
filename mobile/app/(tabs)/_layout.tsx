import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { FeatureDock } from '../../components/navigation/FeatureDock';
import { TAB_ITEMS } from '../../components/navigation/tabs';

/**
 * The app has no global bottom bar.
 *
 * The launcher is the landing screen and shows no dock at all; each feature
 * brings its own set of destinations instead (see `FeatureDock` and the
 * `dock` field in `constants/features.ts`). The navigator is kept for the
 * per-route state and back behaviour it provides, but its bar is suppressed
 * and the contextual dock is drawn over the top.
 */
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => null}
      >
        {TAB_ITEMS.map((item) => (
          <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
        ))}
      </Tabs>

      <FeatureDock />
    </View>
  );
}
