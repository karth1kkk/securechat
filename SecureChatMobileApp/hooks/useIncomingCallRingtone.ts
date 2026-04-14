import { useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

/**
 * Plays a looping ringtone while {@link shouldPlay} is true (incoming call).
 * Stops and unloads when false or on unmount. Skips on web.
 *
 * Uses DoNotMix so the ring cuts through other audio (MixWithOthers was often too quiet).
 * Repeats vibration on a short interval so the call is noticeable even if speaker volume is low.
 *
 * Rings even when the PIN lock is on so the callee hears the call before unlocking.
 */
export function useIncomingCallRingtone(shouldPlay: boolean): void {
  const soundRef = useRef<Audio.Sound | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!shouldPlay) {
      generationRef.current += 1;
      Vibration.cancel();
      const s = soundRef.current;
      soundRef.current = null;
      void s
        ?.stopAsync()
        .then(() => s.unloadAsync())
        .catch(() => undefined);
      return;
    }

    if (Platform.OS === 'web') {
      return;
    }

    const gen = ++generationRef.current;
    let cancelled = false;

    /** Pulse so devices with low volume still notice the call */
    const vibrateOnce = () => {
      try {
        Vibration.vibrate(500);
      } catch {
        /* ignore */
      }
    };
    vibrateOnce();
    const vibrateInterval = setInterval(vibrateOnce, 2200);

    void (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false
        });
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/sounds/incoming_ring.wav'),
          { isLooping: true, volume: 1.0, shouldPlay: false }
        );
        if (cancelled || gen !== generationRef.current) {
          await sound.unloadAsync();
          return;
        }
        await sound.setVolumeAsync(1.0);
        await sound.playAsync();
        soundRef.current = sound;
      } catch (e) {
        console.warn('Incoming call ringtone failed', e);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(vibrateInterval);
      Vibration.cancel();
      generationRef.current += 1;
      const s = soundRef.current;
      soundRef.current = null;
      void s
        ?.stopAsync()
        .then(() => s.unloadAsync())
        .catch(() => undefined);
    };
  }, [shouldPlay]);
}
