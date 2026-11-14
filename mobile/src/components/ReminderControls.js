import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Shared by onboarding and Settings so the two cannot drift apart.

// A short list rather than a clock: no time-picker dependency, one tap, and
// these cover the moments people actually attach a habit to — waking, the
// commute, lunch, the evening.
export const REMINDER_TIMES = ['07:00', '08:00', '12:30', '18:00', '20:00', '21:30'];

export const WHYS = [
  { id: 'trip', icon: '✈️', label: 'A trip' },
  { id: 'family', icon: '👪', label: 'Family' },
  { id: 'work', icon: '💼', label: 'Work' },
  { id: 'curiosity', icon: '✨', label: 'Curiosity' },
];

export function ChipRow({ options, value, onChange, disabled }) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const id = o.id ?? o;
        const active = value === id;
        return (
          <Pressable
            key={id}
            disabled={disabled}
            onPress={() => onChange(id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!disabled }}
            style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.icon ? `${o.icon} ` : ''}{o.label ?? o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The learner's saved time may not be one of the presets (it can be set to
// anything on the web), so it is always shown among the choices.
export function timeOptions(current) {
  return current && !REMINDER_TIMES.includes(current)
    ? [...REMINDER_TIMES, current].sort()
    : REMINDER_TIMES;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 2, borderColor: colors.line, backgroundColor: '#fff',
  },
  chipActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 14.5, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.tealDark },
});
