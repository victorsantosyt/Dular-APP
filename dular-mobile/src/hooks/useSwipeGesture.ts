import { PanResponder } from "react-native";

export function useSwipeGesture(options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) {
  const { onSwipeLeft, onSwipeRight, threshold = 50 } = options;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10,
    onPanResponderRelease: (_, { dx, vx }) => {
      if ((dx < -threshold || vx < -0.5) && onSwipeLeft) onSwipeLeft();
      if ((dx > threshold || vx > 0.5) && onSwipeRight) onSwipeRight();
    },
  });

  return panResponder.panHandlers;
}
