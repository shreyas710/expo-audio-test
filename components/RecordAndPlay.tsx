import { Pressable, StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState } from "react";
import { AudioModule, useAudioPlayer } from "expo-audio";
import { record_end, record_start } from "../assets/audio";
import { useAudioContext } from "../context/AudioContext";
import PlayButton from "./PlayButton";

export default function RecordAndPlay() {
  const [recordFileUrl, setRecordFileUrl] = useState<string | null>(null);

  const {
    isPlaying,
    isRecording,
    startRecording,
    stopRecording,
    prepareToRecord,
    postStopRecording,
  } = useAudioContext();

  // keepAudioSessionActive: true prevents the chime player from calling
  // session.setActive(false) (with a 100ms delay) when playback finishes.
  // Without this, the deactivation fires ~100ms after the chime ends while
  // recorder.record() is already running, sending an AVAudioSession interruption
  // that stops the recording after ~98ms. Subsequent recordings weren't affected
  // because prepareToRecordAsync() calls session.setActive(true) in its critical
  // path, which prevents the deactivation from succeeding.
  const startPlayer = useAudioPlayer(record_start, { keepAudioSessionActive: true });
  const endPlayer = useAudioPlayer(record_end);

  const isDisabled = isPlaying;

  const handleRecordButtonPress = async () => {
    if (isRecording) {
      console.log("[timing] stop button pressed:", Date.now());
      const uri = await stopRecording();
      await postStopRecording();

      await endPlayer.seekTo(0);
      endPlayer.play();

      if (uri == "") {
        console.log("Failed to record. Please try again.");
        return;
      }

      setRecordFileUrl(uri);
    } else {
      console.log("[timing] record button pressed:", Date.now());
      await startPlayer.seekTo(0);
      console.log("[timing] start chime playing:", Date.now());
      startPlayer.play();

      const unsub = startPlayer.addListener(
        "playbackStatusUpdate",
        async (status) => {
          if (status.didJustFinish) {
            console.log("[timing] chime finished, calling startRecording:", Date.now());
            await startRecording();
            console.log("[timing] startRecording returned (recording active):", Date.now());
            unsub.remove();
          }
        },
      );
    }
  };

  // Pre-warm the recorder on mount so prepareToRecordAsync is NOT in the
  // critical path between chime finishing and recording starting.
  useEffect(() => {
    console.log("[timing] mount: pre-warming recorder:", Date.now());
    prepareToRecord()
      .then(() => console.log("[timing] mount: pre-warm done:", Date.now()))
      .catch((e) => console.error("[timing] mount: pre-warm failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        let permissionResponse =
          await AudioModule.getRecordingPermissionsAsync();
        console.log("__permissionResponse__", permissionResponse);
        if (!permissionResponse.granted) {
          permissionResponse =
            await AudioModule.requestRecordingPermissionsAsync();
        }
      } catch (error) {
        console.error("Mic Permission request failed:", error);
      }
    };

    const prepareToRecordAndPlay = async () => {
      await startPlayer.seekTo(0);
    };
    prepareToRecordAndPlay();
    requestPermission();
  }, [startPlayer]);

  return (
    <View
      style={{ flexDirection: "row", columnGap: 30, alignItems: "flex-end" }}>
      <View style={styles.glowWrapper}>
        <Pressable disabled={isDisabled} onPress={handleRecordButtonPress}>
          <View
            style={[
              styles.button,
              {
                backgroundColor: isDisabled ? "#9c9c9c" : "#FF7BA1",
                opacity: isDisabled ? 0.8 : 1,
              },
            ]}>
            <Text
              style={{
                color: isRecording ? "red" : "white",
                fontSize: 16,
                fontWeight: "700",
              }}>
              {isRecording ? "Stop" : "Record"}
            </Text>
          </View>
        </Pressable>
      </View>
      {recordFileUrl ? (
        <View style={styles.glowWrapper}>
          <View style={styles.button}>
            <PlayButton
              soundUri={{ uri: recordFileUrl }}
              disabled={isRecording}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
  },
  glowWrapper: {
    padding: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
});
