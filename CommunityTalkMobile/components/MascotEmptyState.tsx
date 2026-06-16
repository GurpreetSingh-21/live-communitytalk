import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MotiView } from 'moti';

interface MascotEmptyStateProps {
  title: string;
  subtitle: string;
}

const { width } = Dimensions.get('window');

export function MascotEmptyState({ title, subtitle }: MascotEmptyStateProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View style={styles.container}>
      
      {/* ─── Floating Mascot (Masked nicely) ─── */}
      <MotiView
        from={{ translateY: -8 }}
        animate={{ translateY: 8 }}
        transition={{ loop: true, type: 'timing', duration: 3000, repeatReverse: true }}
        style={styles.mascotHover}
      >
        <MotiView
          from={{ opacity: 0, scale: 0.8, translateY: 20 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 16, delay: 100 }}
        >
          <View style={[
            styles.mascotWrapper, 
            { 
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
              shadowColor: isDark ? '#000' : theme.primary,
            }
          ]}>
            <Image 
              source={require('../assets/images/mascot_cat.png')} 
              style={styles.mascotImage} 
              resizeMode="cover" 
            />
          </View>
        </MotiView>
      </MotiView>

      {/* ─── Animated Text ─── */}
      <MotiView
        from={{ opacity: 0, translateY: 15 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 16, delay: 250 }}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
      </MotiView>

      <MotiView
        from={{ opacity: 0, translateY: 15 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 16, delay: 350 }}
      >
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {subtitle}
        </Text>
      </MotiView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 32,
    position: 'relative',
  },
  mascotHover: {
    zIndex: 2,
    marginBottom: 32,
  },
  mascotWrapper: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  mascotImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: Fonts!.bold,
    fontSize: 24,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts!.regular,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
