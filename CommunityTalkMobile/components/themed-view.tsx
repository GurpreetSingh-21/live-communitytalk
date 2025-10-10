//CommunityTalkMobile/components/themed-view.tsx
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
};

export function ThemedView({ style, lightColor, darkColor, className, ...otherProps }: ThemedViewProps) {
  // Only apply template bg if no Tailwind bg-* class was given
  const hasBgClass = typeof className === 'string' && /\bbg-/.test(className);
  const backgroundColor = !hasBgClass ? useThemeColor({ light: lightColor, dark: darkColor }, 'background') : undefined;

  return <View className={className} style={[backgroundColor ? { backgroundColor } : null, style]} {...otherProps} />;
}