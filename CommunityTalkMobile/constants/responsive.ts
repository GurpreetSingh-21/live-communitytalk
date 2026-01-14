import { Dimensions, Platform } from 'react-native';
import { useMemo } from 'react';

const { width, height } = Dimensions.get('window');

// Breakpoints
export const BREAKPOINTS = {
    phone: 0,
    tablet: 768,
    desktop: 1024,
} as const;

/**
 * Check if current device is a tablet
 */
export const isTablet = (): boolean => {
    return width >= BREAKPOINTS.tablet;
};

/**
 * Check if device is in landscape mode
 */
export const isLandscape = (): boolean => {
    return width > height;
};

/**
 * Get device type
 */
export type DeviceType = 'phone' | 'tablet';

export const useDeviceType = (): DeviceType => {
    return useMemo(() => {
        return width >= BREAKPOINTS.tablet ? 'tablet' : 'phone';
    }, []);
};

/**
 * Return different values based on device type
 * @example
 * const columns = useResponsiveValue({ phone: 1, tablet: 2 });
 */
export const useResponsiveValue = <T,>(values: { phone: T; tablet: T }): T => {
    const deviceType = useDeviceType();
    return values[deviceType];
};

/**
 * Get responsive spacing
 */
export const getResponsiveSpacing = (baseSpacing: number): number => {
    return isTablet() ? baseSpacing * 1.5 : baseSpacing;
};

/**
 * Get responsive font size
 */
export const getResponsiveFontSize = (baseFontSize: number): number => {
    return isTablet() ? baseFontSize * 1.1 : baseFontSize;
};

/**
 * Get max content width for better readability on large screens
 */
export const getMaxContentWidth = (): number => {
    return isTablet() ? 1200 : width;
};

/**
 * Get number of columns for grid layouts
 */
export const getGridColumns = (defaultColumns: number = 1): number => {
    return isTablet() ? Math.min(defaultColumns * 2, 3) : defaultColumns;
};

/**
 * Calculate percentage-based width
 */
export const widthPercentage = (percentage: number): number => {
    return (width * percentage) / 100;
};

/**
 * Calculate percentage-based height
 */
export const heightPercentage = (percentage: number): number => {
    return (height * percentage) / 100;
};

// Export dimensions
export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;
