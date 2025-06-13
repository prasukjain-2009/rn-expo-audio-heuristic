import * as Audio from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, PermissionsAndroid, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { AudioHeuristics } = NativeModules;

interface AudioHeuristicsType {
  measureAmbientNoise(): Promise<{ dB: number; noiseLevel: string }>;
  removeBackgroundNoise(audioFileURL: string): Promise<string>;
}

interface NoiseLevel {
  dB: number;
  noiseLevel: string;
}

export const AudioRecorder: React.FC = () => {
  const [audioHeuristicsEnabled, setAudioHeuristicsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorder = Audio.useAudioRecorder({
    isMeteringEnabled: true,
    bitRate: 128000,
    sampleRate: 44100,
    numberOfChannels: 2,
    extension: '.mp4',
    android: {
      outputFormat: 'mpeg4',
      audioEncoder: 'aac',
    },
    ios: {
      outputFormat: 'aac',
      audioQuality: Audio.AudioQuality.HIGH,
    },
  });
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const player = audioUri ? Audio.useAudioPlayer(audioUri) : null;
  const [noiseLevel, setNoiseLevel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const requestAndroidPermissions = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "This app needs access to your microphone to record audio",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Failed to request Android permission:', err);
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        let permissionGranted = false;
        
        if (Platform.OS === 'android') {
          permissionGranted = await requestAndroidPermissions();
        } else {
          const { status } = await Audio.requestRecordingPermissionsAsync();
          permissionGranted = status === 'granted';
        }
        
        setHasPermission(permissionGranted);
        if (!permissionGranted) {
          setError('Microphone permission not granted');
        }

        if (permissionGranted) {
          // Initialize audio mode first
          await Audio.setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
          });

          // Prepare the recorder
          await recorder.prepareToRecordAsync(Audio.RecordingPresets.HIGH_QUALITY);
        }
      } catch (err) {
        setError('Failed to initialize audio system');
        console.error('Audio initialization error:', err);
      }
    })();
  }, []);

  useEffect(() => {
    const cleanup = async () => {
      if (player) {
        await player.pause();
      }
      if (recorder && isRecording) {
        await recorder.stop();
      }
    };

    return () => {
      cleanup().catch(console.error);
    };
  }, [player, recorder, isRecording]);

  const measureNoise = async () => {
    try {
      if (!hasPermission) {
        setError('Microphone permission not granted');
        return;
      }

      if (Platform.OS === 'ios') {
        const result = await (AudioHeuristics as AudioHeuristicsType).measureAmbientNoise();
        return setNoiseLevel(`${result.noiseLevel} (${result.dB.toFixed(1)} dB)`);
      } 
      if (Platform.OS === 'android') {
        const status = await recorder.getStatus();
        const soundLevel = status.metering
        console.log('metering', status);
        if (soundLevel) {
          return setNoiseLevel(`${soundLevel} dB`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to measure noise');
    }
  };

  const handleRecordPress = async () => {
    if (!isRecording) {
      try {
        // Check if recorder is prepared
        const status = await recorder.getStatus();
        if (!status.canRecord) {
          // Try to prepare again if not ready
          await recorder.prepareToRecordAsync(Audio.RecordingPresets.HIGH_QUALITY);
        }

        setIsRecording(true);
        await recorder.record(); // Use startAsync instead of record()

        // Wait for recorder to be ready
        setTimeout(async () => {
          const recordingStatus = await recorder.getStatus();
          console.log('recording status:', recordingStatus);
          if (recordingStatus.isRecording) {
            measureNoise();
          } else {
            console.log('recorder not ready:', recordingStatus);
            setIsRecording(false);
            setError('Failed to start recording. Please try again.');
          }
        }, 1000);
      } catch (err) {
        console.error('Error starting recording:', err);
        setIsRecording(false);
        setError('Failed to start recording: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else {
      try {
        setIsRecording(false);
        await recorder.stop();
        setNoiseLevel(null);
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Failed to stop recording: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  const startRecording = async () => {
    try {
      if (!hasPermission) {
        if (Platform.OS === 'android') {
          const granted = await requestAndroidPermissions();
          if (!granted) {
            setError('Microphone permission not granted');
            return;
          }
          setHasPermission(true);
        } else {
          setError('Microphone permission not granted');
          return;
        }
      }

      if (audioHeuristicsEnabled) {
        const noiseLevel: NoiseLevel = await AudioHeuristics.measureAmbientNoise();
        if (noiseLevel.dB > -30) {
          Alert.alert('Warning', 'Noise level too high. Canceling recording.');
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.record();
      setIsRecording(true);
      setError(null);

      // Wait for recorder to be ready
      setTimeout(async () => {
        const recordingStatus = await recorder.getStatus();
        console.log('recording status:', recordingStatus);
        if (recordingStatus.isRecording) {
          measureNoise();
        } else {
          console.log('recorder not ready:', recordingStatus);
          setIsRecording(false);
          setError('Failed to start recording. Please try again.');
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      setError('Failed to start recording');
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recorder || !isRecording) return;

    try {
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);
      setNoiseLevel(null);

      if (uri && audioHeuristicsEnabled) {
        const cleanedUri = await AudioHeuristics.removeBackgroundNoise(uri);
        setAudioUri(cleanedUri);
      } else if (uri) {
        setAudioUri(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playRecording = async () => {
    if (!audioUri || !player) return;

    try {
      if (isPlaying) {
        await player.pause();
        setIsPlaying(false);
      } else {
        await player.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Failed to play recording', err);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const deleteRecording = async () => {
    if (!audioUri) return;

    try {
      await FileSystem.deleteAsync(audioUri);
      setAudioUri(null);
      if (player) {
        await player.pause();
      }
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to delete recording', err);
      Alert.alert('Error', 'Failed to delete recording');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={[styles.checkbox, audioHeuristicsEnabled && styles.checkboxChecked]}
          onPress={() => setAudioHeuristicsEnabled(!audioHeuristicsEnabled)}
        />
        <Text style={styles.checkboxLabel}>Enable Audio Heuristics</Text>
      </View>

      {!audioUri ? (
        <TouchableOpacity
          style={[styles.button, isRecording && styles.buttonRecording]}
          onPress={handleRecordPress}
        >
          <Text style={styles.buttonText}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.playButton]}
            onPress={playRecording}
          >
            <Text style={styles.buttonText}>
              {isPlaying ? 'Pause' : 'Play'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={deleteRecording}
          >
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {noiseLevel && (
        <Text style={styles.noiseLevel}>
          Ambient Noise Level: {noiseLevel}
        </Text>
      )}
      {error && (
        <Text style={styles.error}>
          Error: {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonRecording: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playButton: {
    flex: 1,
    marginRight: 10,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
  },
  noiseLevel: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  error: {
    marginTop: 20,
    color: 'red',
    fontSize: 16,
  },
}); 