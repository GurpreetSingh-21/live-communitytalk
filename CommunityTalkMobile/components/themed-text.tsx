//CommunityTalkMobile/components/themed-text.tsx
import * as React from 'react';
import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const typeStyle = (type: ThemedTextProps['type']): StyleProp<TextStyle> => {
  switch (type) {
    case 'title':           return { fontSize: 32, fontWeight: '700', lineHeight: 32 };
    case 'subtitle':        return { fontSize: 20, fontWeight: '700' };
    case 'defaultSemiBold': return { fontSize: 16, lineHeight: 24, fontWeight: '600' };
    case 'link':            return { fontSize: 16, lineHeight: 24, textDecorationLine: 'underline' };
    default:                return { fontSize: 16, lineHeight: 24 };
  }
};

export const ThemedText = React.forwardRef<Text, ThemedTextProps>(
  ({ style, lightColor, darkColor, className, type = 'default', ...rest }, ref) => {
    // If caller provided any Tailwind text-* class, don’t override it with template color
    const hasTextClass = typeof className === 'string' && /\btext-/.test(className);
    const color = !hasTextClass ? useThemeColor({ light: lightColor, dark: darkColor }, 'text') : undefined;

    return (
      <Text
        ref={ref}
        className={className}
        style={[typeStyle(type), color ? { color } : null, style]}
        {...rest}
      />
    );
  }
);
ThemedText.displayName = 'ThemedText';