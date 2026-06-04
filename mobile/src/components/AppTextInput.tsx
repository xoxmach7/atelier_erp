import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const INPUT_MAX_WIDTH = 326;
const INPUT_HEIGHT = 44;
const INPUT_RADIUS = 10;

interface AppTextInputProps extends TextInputProps {}

export function AppTextInput({ style, ...rest }: AppTextInputProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={colors.textMuted}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.input,
    borderRadius: INPUT_RADIUS,
    height: INPUT_HEIGHT,
    paddingHorizontal: 16,
    fontSize: typography.sizes.base,
    color: colors.text,
    width: '100%',
    maxWidth: INPUT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
