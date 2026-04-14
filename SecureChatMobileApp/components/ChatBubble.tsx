import React from 'react';
import { Image, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '../theme/ThemeContext';
import { cn } from '../lib/cn';
import { parseRichMessage } from '../lib/chatRichMessage';

interface Props {
  text: string;
  /** Raw decrypted content for rich media rendering. */
  rawContent?: string;
  isOutgoing?: boolean;
  timestamp?: string;
  status?: 'sending' | 'sent';
}

export const ChatBubble: React.FC<Props> = ({ text, rawContent, isOutgoing = false, timestamp, status }) => {
  const { palette } = useTheme();
  const rich =
    parseRichMessage(rawContent ?? '') || parseRichMessage(text ?? '');

  const renderBody = () => {
    if (!rich) {
      return (
        <Text className="text-base" style={{ color: palette.text }}>
          {text}
        </Text>
      );
    }

    switch (rich.type) {
      case 'text':
        return (
          <Text className="text-base" style={{ color: palette.text }}>
            {rich.text}
          </Text>
        );
      case 'sticker':
        return (
          <Text className="text-base" style={{ color: palette.text, fontSize: 44, lineHeight: 52 }}>
            {rich.emoji}
          </Text>
        );
      case 'gif':
        return (
          <Image
            source={{ uri: rich.url }}
            style={{ width: 220, height: 160, borderRadius: 12 }}
            resizeMode="cover"
          />
        );
      case 'image':
        return (
          <Image
            source={{ uri: `data:${rich.mime};base64,${rich.base64}` }}
            style={{ width: 220, height: 220, borderRadius: 12 }}
            resizeMode="cover"
          />
        );
      case 'video':
        return (
          <Video
            source={{ uri: `data:${rich.mime};base64,${rich.base64}` }}
            style={{ width: 220, height: 140, borderRadius: 12 }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            isLooping={false}
          />
        );
      default:
        return (
          <Text className="text-base" style={{ color: palette.text }}>
            {text}
          </Text>
        );
    }
  };

  return (
    <View
      className={cn('my-1 max-w-[90%] rounded-2xl p-3', isOutgoing ? 'self-end' : 'self-start')}
      style={{
        backgroundColor: isOutgoing ? palette.bubbleOutgoing : palette.bubbleIncoming
      }}
    >
      {renderBody()}
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
