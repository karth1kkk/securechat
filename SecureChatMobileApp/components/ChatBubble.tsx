import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  text: string;
  isOutgoing?: boolean;
}

export const ChatBubble: React.FC<Props> = ({ text, isOutgoing = false }) => (
  <View style={[styles.container, isOutgoing ? styles.outgoing : styles.incoming]}>
    <Text style={styles.text}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: '80%'
  },
  incoming: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  outgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a9cff'
  },
  text: {
    color: '#f7f7f7'
  }
});
