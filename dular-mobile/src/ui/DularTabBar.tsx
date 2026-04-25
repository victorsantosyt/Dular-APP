import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "@/theme/tokens";

type Tab = { key: string; label: string; icon: "home" | "wallet" | "more" };

type Props = {
  active: string;
  onPress: (key: string) => void;
  tabs: Tab[];
};

function resolveIcon(tab: Tab, focused: boolean): React.ComponentProps<typeof Ionicons>["name"] {
  if (tab.icon === "home") return focused ? "home" : "home-outline";
  if (tab.icon === "wallet") return focused ? "wallet" : "wallet-outline";
  return focused ? "ellipsis-horizontal" : "ellipsis-horizontal-outline";
}

export function DularTabBar({ active, onPress, tabs }: Props) {
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={[s.bar, shadow.float]}>
        {tabs.map((tab) => {
          const focused = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onPress(tab.key)}
              style={({ pressed }) => [s.tab, focused && s.tabActive, pressed && s.tabPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <Ionicons
                name={resolveIcon(tab, focused)}
                size={20}
                color={focused ? colors.green : colors.sub}
              />
              <Text style={[s.label, { color: focused ? colors.green : colors.sub }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 14,
    left: 12,
    right: 12,
  },
  bar: {
    backgroundColor: colors.card,
    borderRadius: radius.tabbar,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tab: {
    minWidth: 90,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 3,
  },
  tabActive: {
    backgroundColor: colors.greenLight,
  },
  tabPressed: {
    opacity: 0.75,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
  },
});
