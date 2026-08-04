import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ModuleKey } from '../../hooks/usePermissions';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type TabItem = {
  /** Route name of the folder inside `app/(tabs)`. */
  name: string;
  label: string;
  icon: IconName;
  /** Filled counterpart of `icon`, cross-faded in when the tab is selected. */
  iconActive: IconName;
  /** A tab is hidden when the signed-in user can't read anything behind it. */
  isVisible: (canRead: (module: ModuleKey) => boolean) => boolean;
};

/**
 * Single source of truth for the bottom navigation: the layout registers a
 * screen per entry and the tab bar renders them in this order.
 */
export const TAB_ITEMS: TabItem[] = [
  {
    name: 'home',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    isVisible: (canRead) => canRead('dashboard'),
  },
  {
    name: 'clients',
    label: 'Clients',
    icon: 'people-outline',
    iconActive: 'people',
    isVisible: (canRead) => canRead('clients'),
  },
  {
    name: 'social',
    label: 'Social',
    icon: 'share-social-outline',
    iconActive: 'share-social',
    isVisible: (canRead) => canRead('social_media'),
  },
  {
    name: 'money',
    label: 'Money',
    icon: 'wallet-outline',
    iconActive: 'wallet',
    isVisible: (canRead) => canRead('invoices') || canRead('proforma') || canRead('expenses'),
  },
  {
    name: 'more',
    label: 'More',
    icon: 'grid-outline',
    iconActive: 'grid',
    isVisible: () => true,
  },
];
