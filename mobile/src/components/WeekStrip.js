import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// The last seven days, oldest first: a filled dot for a day with practice.
// A record, not a threat — a missed day is an empty dot and nothing more.
export default function WeekStrip({ week, light = false, style }) {
  if (!week?.length) return null;
  const practised = week.filter((d) => d.practised).length;

  return (
    <View
      style={[styles.strip, style]}
      accessible
      accessibilityLabel={`Practised on ${practised} of the last ${week.length} days`}
    >
      {week.map((d) => (
        <View
          key={d.date}
          style={[
            styles.dot,
            light && styles.dotLight,
            d.practised && (light ? styles.dotOnLight : styles.dotOn),
            d.isToday && styles.dotToday,
          ]}
        />
      ))}
      <Text style={[styles.label, light && styles.labelLight]}>last 7 days</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 11, height: 11, borderRadius: 50, borderWidth: 2, borderColor: colors.line },
  dotLight: { borderColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  dotOnLight: { backgroundColor: colors.goldLight, borderColor: colors.goldLight },
  dotToday: { transform: [{ scale: 1.2 }] },
  label: { fontSize: 12, color: colors.muted, marginLeft: 4 },
  labelLight: { color: '#cfe0e8' },
});
