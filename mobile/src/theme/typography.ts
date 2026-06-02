export const fontFamily = {
  regular: 'TTNormsPro-Regular',
  medium: 'TTNormsPro-Medium',
} as const;

export const typography = {
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    '2xl': 22,
    '3xl': 26,
    '4xl': 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export type Typography = typeof typography;
