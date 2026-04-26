import { Pressable, StyleSheet, Text, View } from "react-native";
import React, { useEffect, useState, useRef } from "react";
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
  } = useAudioContext();

  const startPlayer = useAudioPlayer(record_start);
  const endPlayer = useAudioPlayer(record_end);

  const isDisabled = isPlaying;

  const handleRecordButtonPress = async () => {
    if (isRecording) {
      const uri = await stopRecording();

      await endPlayer.seekTo(0);
      endPlayer.play();
      const unsub = endPlayer.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          unsub.remove();
        }
      });

      if (uri == "") {
        console.log("Failed to record. Please try again.");
        return;
      }

      setRecordFileUrl(uri);
    } else {
      const unsub = startPlayer.addListener(
        "playbackStatusUpdate",
        async (status) => {
          if (status.didJustFinish) {
            unsub.remove();
            await startRecording();
          }
        },
      );

      await startPlayer.seekTo(0);
      startPlayer.play();
    }
  };

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
      await prepareToRecord();
    };
    prepareToRecordAndPlay();
    requestPermission();
  }, []);

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
