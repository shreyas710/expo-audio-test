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
  postStopRecording: () => Promise<void>;
};

const defaultAudioContextValue: AudioContextType = {
  isPlaying: false,
  isRecording: false,
  playAudio: async () => {},
  stopAllAudio: () => {},
  startRecording: async () => {},
  stopRecording: async () => "",
  prepareToRecord: async () => {},
  postStopRecording: async () => {},
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
  const [isRecorderPrepared, setIsRecorderPrepared] = useState(false);

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

    if (!isRecorderPrepared) {
      console.log("[timing] prepareToRecordAsync start:", Date.now());
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      console.log("[timing] prepareToRecordAsync done:", Date.now());
      setIsRecorderPrepared(true);
    } else {
      console.log("[timing] prepareToRecord: already prepared, skipping prepareToRecordAsync");
    }

    // Return to playback category so audio routes through the speaker.
    // startRecording() switches back to allowsRecording:true before record().
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [permissionGranted, isRecorderPrepared, recorder]);

  const startRecording = useCallback(async () => {
    // Always reactivate the audio session here. The chime player has no
    // keepAudioSessionActive, so AVAudioSession is deactivated when the chime
    // finishes. Without this call the recorder starts on a dead session and
    // produces a near-empty file, even when the recorder was pre-warmed.
    console.log("[timing] startRecording: setAudioModeAsync (reactivate session):", Date.now());
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    console.log("[timing] startRecording: session active:", Date.now());

    if (!isRecorderPrepared) {
      console.log("[timing] startRecording: not pre-warmed, calling prepareToRecordAsync:", Date.now());
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      console.log("[timing] startRecording: prepareToRecordAsync done:", Date.now());
      setIsRecorderPrepared(true);
    } else {
      // Fast reset: reuses same AVAudioRecorder and file path, just moves native
      // state from .stopped back to .prepared. No new recorder allocation, no new UUID.
      console.log("[timing] startRecording: fast reset prepareToRecordAsync (no options):", Date.now());
      await recorder.prepareToRecordAsync();
      console.log("[timing] startRecording: fast reset done:", Date.now());
    }

    console.log("[timing] recorder.record() called:", Date.now());
    recorder.record();
  }, [isRecorderPrepared, recorder]);

  const stopRecording = useCallback(async () => {
    await recorder.stop();
    const uri = recorder.uri ?? "";
    console.log("[AudioContext] recorded file uri:", uri);
    return uri;
  }, [recorder]);

  const postStopRecording = useCallback(async () => {
    // Return to playback category so the end chime and recorded-audio playback
    // route through the speaker instead of the earpiece.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, []);

  const value: AudioContextType = {
    isPlaying: playerStatus.playing,
    isRecording: recorderState.isRecording,
    playAudio,
    stopAllAudio,
    startRecording,
    stopRecording,
    prepareToRecord,
    postStopRecording,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}
