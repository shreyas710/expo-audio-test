import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AudioModule,
  AudioSource,
  AudioStatus,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export type AudioContextType = {
  isPlaying: boolean;
  isRecording: boolean;
  playAudio: (
    audioSource: AudioSource,
    onStatusUpdate?: (status: AudioStatus) => void,
  ) => Promise<void>;
  stopAllAudio: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  prepareToRecord: () => Promise<void>;
};

const defaultAudioContextValue: AudioContextType = {
  isPlaying: false,
  isRecording: false,
  playAudio: async () => {},
  stopAllAudio: () => {},
  startRecording: async () => {},
  stopRecording: async () => "",
  prepareToRecord: async () => {},
};

const AudioContext = createContext<AudioContextType>(defaultAudioContextValue);

export const useAudioContext = () => useContext(AudioContext);

/** Local paths without a scheme need a file:// prefix for native players. */
function normalizePlaybackSource(source: AudioSource): AudioSource {
  if (source == null) {
    return source;
  }
  if (typeof source === "string") {
    const s = source.trim();
    if (!s) {
      return source;
    }
    if (/^[a-zA-Z][a-zA-Z+\-.]*:\/\//.test(s)) {
      return s;
    }
    if (s.startsWith("/")) {
      return `file://${s}`;
    }
    return s;
  }
  if (
    typeof source === "object" &&
    "uri" in source &&
    typeof source.uri === "string"
  ) {
    const s = source.uri.trim();
    if (!s) {
      return source;
    }
    if (/^[a-zA-Z][a-zA-Z+\-.]*:\/\//.test(s)) {
      return source;
    }
    if (s.startsWith("/")) {
      return { ...source, uri: `file://${s}` };
    }
    return source;
  }
  return source;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [permissionGranted, setPermissionGranted] = useState(false);

  const playbackCallbackRef = useRef<
    ((status: AudioStatus) => void) | undefined
  >(undefined);

  useEffect(() => {
    playbackCallbackRef.current?.(playerStatus);
  }, [playerStatus]);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        let status = await AudioModule.getRecordingPermissionsAsync();
        if (!status.granted) {
          status = await AudioModule.requestRecordingPermissionsAsync();
        }
        if (status.granted) {
          setPermissionGranted(true);
        }
      } catch (error) {
        console.error("Mic permission request failed:", error);
      }
    };
    void requestPermission();
  }, []);

  const stopAllAudio = useCallback(() => {
    playbackCallbackRef.current = undefined;
    player.pause();
    void player.seekTo(0);
  }, [player]);

  const playAudio = useCallback(
    async (
      audioSource: AudioSource,
      onStatusUpdate?: (status: AudioStatus) => void,
    ) => {
      stopAllAudio();
      playbackCallbackRef.current = onStatusUpdate;

      player.replace(audioSource);
      await player.seekTo(0);
      player.play();
    },
    [player, stopAllAudio],
  );

  const prepareToRecord = useCallback(async () => {
    if (!permissionGranted) {
      let status = await AudioModule.getRecordingPermissionsAsync();
      if (!status.granted) {
        status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          return;
        }
      }
      setPermissionGranted(true);
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
  }, [permissionGranted, recorder]);

  const startRecording = useCallback(async () => {
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    await recorder.stop();
    const uri = recorder.uri ?? "";
    return uri;
  }, [recorder]);

  const value: AudioContextType = {
    isPlaying: playerStatus.playing,
    isRecording: recorderState.isRecording,
    playAudio,
    stopAllAudio,
    startRecording,
    stopRecording,
    prepareToRecord,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}
