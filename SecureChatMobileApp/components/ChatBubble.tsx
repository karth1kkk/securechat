import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  text: string;
  isOutgoing?: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent';
}

export const ChatBubble: React.FC<Props> = ({ text, isOutgoing = false, timestamp, status }) => {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
          backgroundColor: isOutgoing ? palette.bubbleOutgoing : palette.bubbleIncoming
        }
      ]}
    >
      <Text style={[styles.text, { color: palette.text }]}>{text}</Text>
      {(timestamp || (isOutgoing && status)) && (
        <View style={styles.metaRow}>
          {timestamp && <Text style={[styles.meta, { color: palette.muted }]}>{timestamp}</Text>}
          {isOutgoing && status && (
            <Text style={[styles.meta, { color: palette.muted, marginLeft: 8 }]}>
              {status === 'sending' ? 'Sending…' : 'Sent'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: '80%'
  },
  text: {
    fontSize: 16
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  meta: {
    fontSize: 10
  }
});
