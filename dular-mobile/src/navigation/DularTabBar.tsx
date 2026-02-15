import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

type Props = BottomTabBarProps & { insets: { bottom: number } };

export default function DularTabBar({ state, descriptors, navigation, insets }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        height: 64 + (insets?.bottom ?? 0),
        paddingTop: 8,
        paddingBottom: 10 + (insets?.bottom ?? 0),
        borderTopWidth: 1,
        borderTopColor: "#EEF2F4",
        backgroundColor: "#FFFFFF",
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const color = focused ? "#4FA38F" : "#A7B3BE";

        let iconName: string = "home-outline";
        if (route.name === "Home") {
          iconName = focused ? "home" : "home-outline";
        } else if (route.name === "Carteira") {
          iconName = focused ? "wallet" : "wallet-outline";
        } else if (route.name === "Solicitações" || route.name === "Solicitacoes") {
          iconName = focused ? "list" : "list-outline";
        } else {
          iconName = focused ? "person" : "person-outline";
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={iconName as any} size={24} color={color} />
            <Text style={{ marginTop: 2, fontSize: 11, fontWeight: "600", color }}>{route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
