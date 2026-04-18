import { Pressable, StyleSheet, Text } from "react-native";
import { useAudioContext } from "../context/AudioContext";

type PlayButtonProps = {
  soundUri: { uri: string };
  disabled?: boolean;
};

export default function PlayButton({ soundUri, disabled }: PlayButtonProps) {
  const { playAudio, isPlaying } = useAudioContext();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      disabled={disabled}
      onPress={() => {
        void playAudio(soundUri);
      }}>
      <Text style={styles.label}>{isPlaying ? "Playing…" : "Play"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    minWidth: 120,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
