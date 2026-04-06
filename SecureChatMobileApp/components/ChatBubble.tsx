import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { cn } from '../lib/cn';

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
      className={cn('my-1 max-w-[80%] rounded-2xl p-3', isOutgoing ? 'self-end' : 'self-start')}
      style={{
        backgroundColor: isOutgoing ? palette.bubbleOutgoing : palette.bubbleIncoming
      }}
    >
      <Text className="text-base" style={{ color: palette.text }}>
        {text}
      </Text>
      {(timestamp || (isOutgoing && status)) && (
        <View className="mt-1 flex-row justify-end">
          {timestamp && (
            <Text className="text-[10px]" style={{ color: palette.muted }}>
              {timestamp}
            </Text>
          )}
          {isOutgoing && status && (
            <Text className="ml-2 text-[10px]" style={{ color: palette.muted }}>
              {status === 'sending' ? 'Sending…' : 'Sent'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};
