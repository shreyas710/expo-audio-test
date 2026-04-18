import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AudioProvider } from './context/AudioContext';
import RecordAndPlay from './components/RecordAndPlay';

export default function App() {
  return (
    <AudioProvider>
      <View style={styles.container}>
        <Text style={styles.title}>Voice memo</Text>
        <Text style={styles.hint}>
          Tap Record to capture audio, then Play to hear it back.
        </Text>
        <RecordAndPlay />
        <StatusBar style="auto" />
      </View>
    </AudioProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
  },
  hint: {
    fontSize: 15,
    color: '#52525b',
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 8,
  },
});
