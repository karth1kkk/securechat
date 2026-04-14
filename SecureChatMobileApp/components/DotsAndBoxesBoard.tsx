import React from 'react';
import { Pressable, View } from 'react-native';
import { ThemePalette } from '../theme/ThemeContext';
import { gridCountsPublic, horizontalEdgeId, verticalEdgeId } from '../lib/games/dotsAndBoxesReplay';

type Props = {
  rows: number;
  cols: number;
  takenEdges: Set<number>;
  boxOwners: ('host' | 'guest' | null)[][];
  palette: ThemePalette;
  /** Whether the local user is the game host (for coloring boxes). */
  iAmHost: boolean;
  myTurn: boolean;
  gameOver: boolean;
  onEdgePress: (edgeId: number) => void;
};

/** Dot grid + line segments similar to Plato-style Dots & Boxes. */
export const DotsAndBoxesBoard: React.FC<Props> = ({
  rows,
  cols,
  takenEdges,
  boxOwners,
  palette,
  iAmHost,
  myTurn,
  gameOver,
  onEdgePress
}) => {
  const { hCount } = gridCountsPublic(rows, cols);

  const dotSize = 7;
  const cell = 34;
  const edgeThick = 5;
  const hitPad = 12;

  const lineTaken = palette.action;
  const lineEmpty = palette.border;
  const lineMuted = palette.muted;

  const boxStyle = (owner: 'host' | 'guest' | null) => {
    const mine = owner && ((owner === 'host' && iAmHost) || (owner === 'guest' && !iAmHost));
    if (!owner) {
      return {
        backgroundColor: palette.surface,
        opacity: 0.55
      };
    }
    return {
      backgroundColor: mine ? palette.action : palette.bubbleIncoming,
      opacity: 0.38
    };
  };

  const canTap = myTurn && !gameOver;

  const horizEdge = (hr: number, hc: number) => {
    const id = horizontalEdgeId(hr, hc, cols);
    const taken = takenEdges.has(id);
    return (
      <Pressable
        key={`h-${hr}-${hc}`}
        disabled={!canTap || taken}
        onPress={() => onEdgePress(id)}
        hitSlop={{ top: hitPad, bottom: hitPad, left: 4, right: 4 }}
        style={{
          width: cell,
          height: edgeThick + hitPad * 0.5,
          justifyContent: 'center',
          alignItems: 'center'
        }}
        accessibilityRole="button"
        accessibilityLabel={`Horizontal line ${hr + 1},${hc + 1}`}
      >
        <View
          style={{
            width: cell,
            height: edgeThick,
            borderRadius: edgeThick / 2,
            backgroundColor: taken ? lineTaken : canTap ? lineEmpty : lineMuted,
            opacity: taken ? 1 : canTap ? 0.85 : 0.45
          }}
        />
      </Pressable>
    );
  };

  const vertEdge = (vr: number, vc: number) => {
    const id = verticalEdgeId(vr, vc, rows, cols, hCount);
    const taken = takenEdges.has(id);
    return (
      <Pressable
        key={`v-${vr}-${vc}`}
        disabled={!canTap || taken}
        onPress={() => onEdgePress(id)}
        hitSlop={{ left: hitPad, right: hitPad, top: 4, bottom: 4 }}
        style={{
          width: edgeThick + hitPad * 0.5,
          height: cell,
          justifyContent: 'center',
          alignItems: 'center'
        }}
        accessibilityRole="button"
        accessibilityLabel={`Vertical line ${vr + 1},${vc + 1}`}
      >
        <View
          style={{
            width: edgeThick,
            height: cell,
            borderRadius: edgeThick / 2,
            backgroundColor: taken ? lineTaken : canTap ? lineEmpty : lineMuted,
            opacity: taken ? 1 : canTap ? 0.85 : 0.45
          }}
        />
      </Pressable>
    );
  };

  const dot = (key: string) => (
    <View
      key={key}
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        backgroundColor: palette.text
      }}
    />
  );

  const boxCell = (sr: number, sc: number) => (
    <View
      key={`cell-${sr}-${sc}`}
      style={{
        width: cell,
        height: cell,
        borderRadius: 8,
        ...boxStyle(boxOwners[sr]?.[sc] ?? null)
      }}
    />
  );

  return (
    <View className="items-center" style={{ paddingVertical: 8 }}>
      {Array.from({ length: rows + 1 }, (_, hr) => (
        <React.Fragment key={`fragment-${hr}`}>
          <View className="flex-row items-center" style={{ justifyContent: 'center' }}>
            {Array.from({ length: cols + 1 }, (_, dc) => (
              <React.Fragment key={`dotrow-${hr}-${dc}`}>
                {dot(`d-${hr}-${dc}`)}
                {dc < cols ? horizEdge(hr, dc) : null}
              </React.Fragment>
            ))}
          </View>
          {hr < rows ? (
            <View className="flex-row items-stretch" style={{ justifyContent: 'center' }}>
              {Array.from({ length: cols + 1 }, (_, vc) => (
                <React.Fragment key={`vrow-${hr}-${vc}`}>
                  {vertEdge(hr, vc)}
                  {vc < cols ? boxCell(hr, vc) : null}
                </React.Fragment>
              ))}
            </View>
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
};
