import {
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, radius, shadow } from '../theme';

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled, block, style }) {
  const palette = {
    primary: { bg: colors.teal, fg: '#fff', border: 'transparent' },
    gold: { bg: colors.gold, fg: '#fff', border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.tealDark, border: colors.teal },
  }[variant];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        size === 'sm' && styles.btnSm,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'ghost' ? 1.5 : 0,
        },
        block && { alignSelf: 'stretch' },
        disabled && { opacity: 0.45 },
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[styles.btnText, size === 'sm' && styles.btnTextSm, { color: palette.fg }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Spinner() {
  return (
    <View style={styles.spinnerWrap}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}

export function ProgressBar({ pct }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
    </View>
  );
}

export function Pill({ children, style }) {
  return <View style={[styles.pill, style]}><Text style={styles.pillText}>{children}</Text></View>;
}

export function Field({ label, children }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: radius,
    alignSelf: 'flex-start',
  },
  btnSm: { paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontWeight: '700', fontSize: 15.5 },
  btnTextSm: { fontSize: 13.5 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow,
  },
  spinnerWrap: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  progressTrack: {
    height: 10,
    backgroundColor: colors.light,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 999 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  field: { marginBottom: 16 },
  fieldLabel: { fontWeight: '600', fontSize: 14, marginBottom: 6, color: colors.ink },
  input: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: colors.ink,
  },
  errorBox: {
    backgroundColor: colors.dangerTint,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});
