import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeContext';

const pathNodes = [
  { type: 'you', label: 'You' },
  { type: 'entry', label: 'Entry Node', country: 'United States' },
  { type: 'service', label: 'Service Node', country: 'Finland' },
  { type: 'service', label: 'Service Node', country: 'Canada' },
  { type: 'destination', label: 'Destination' }
];

export const PathScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Path'>> = () => {
  const { palette } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.25]
  });

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <Text style={[styles.header, { color: palette.text }]}>Path</Text>
      <View style={styles.timelineContainer}>
        <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />
        {pathNodes.map((node, index) => (
          <View key={`${node.type}-${index}`} style={styles.nodeRow}> 
            <View style={styles.dotContainer}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: palette.action,
                    shadowColor: palette.glow,
                    transform: [{ scale }]
                  }
                ]}
              />
            </View>
            <View style={styles.nodeContent}> 
              <Text style={[styles.nodeTitle, { color: palette.text }]}>{node.label}</Text>
              {node.country ? (
                <Text style={[styles.nodeMeta, { color: palette.muted }]}>{node.country}</Text>
              ) : null}
              {node.type === 'service' && (
                <Text style={[styles.nodeChip, { color: palette.text, borderColor: palette.border }]}>Service</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20
  },
  timelineContainer: {
    flex: 1,
    paddingLeft: 24,
    position: 'relative'
  },
  timelineLine: {
    position: 'absolute',
    left: 26,
    top: 28,
    bottom: 24,
    width: 2
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingLeft: 12
  },
  dotContainer: {
    width: 52,
    alignItems: 'center'
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    shadowOpacity: 0.9
  },
  nodeContent: {
    flex: 1
  },
  nodeTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  nodeMeta: {
    fontSize: 14,
    marginTop: 4
  },
  nodeChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 12
  }
});
