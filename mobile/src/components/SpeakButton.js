import { Pressable, Text, StyleSheet } from 'react-native';
import { speakSwahili } from '../lib/speak';
import { colors } from '../theme';

// Reusable 🔊 button that pronounces a Swahili word/phrase.
// variant: 'light' (teal on white) | 'onDark' (translucent, for coloured cards)
// size: 'sm' | 'md'
export default function SpeakButton({ text, variant = 'light', size = 'md', style }) {
  if (!text) return null;
  const dim = size === 'sm' ? 26 : 40;
  const onDark = variant === 'onDark';
  return (
    <Pressable
      onPress={() => speakSwahili(text)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Hear ${text} spoken`}
      style={[
        styles.btn,
        { width: dim, height: dim, borderRadius: dim / 2 },
        onDark
          ? { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.75)' }
          : { backgroundColor: '#fff', borderColor: colors.teal },
        style,
      ]}
    >
      <Text style={{ fontSize: size === 'sm' ? 13 : 18 }}>🔊</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
});
