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
    console.log("[AudioContext] playerStatus changed:", {
      playing: playerStatus.playing,
      duration: playerStatus.duration,
      currentTime: playerStatus.currentTime,
    });
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
    console.log("[AudioContext] stopAllAudio called");
    playbackCallbackRef.current = undefined;
    console.log("[AudioContext] pausing player");
    player.pause();
    console.log("[AudioContext] seeking to 0");
    void player.seekTo(0);
  }, [player]);

  const playAudio = useCallback(
    async (
      audioSource: AudioSource,
      onStatusUpdate?: (status: AudioStatus) => void,
    ) => {
      console.log("[AudioContext] playAudio called, audioSource:", audioSource);
      console.log("[timing] playAudio start:", Date.now());

      stopAllAudio();
      console.log("[AudioContext] stopAllAudio completed");

      playbackCallbackRef.current = onStatusUpdate;

      console.log("[AudioContext] replacing player source");
      player.replace(audioSource);
      console.log("[AudioContext] seeking to 0");
      await player.seekTo(0);
      console.log("[AudioContext] calling player.play()");
      player.play();
      console.log("[timing] playAudio end (play() called):", Date.now());
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
    console.log("[timing] postStopRecording: setting playback mode:", Date.now());
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    console.log("[timing] postStopRecording: playback mode set:", Date.now());
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
