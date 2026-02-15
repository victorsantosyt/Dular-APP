import { createNavigationContainerRef, CommonActions } from "@react-navigation/native";

export const navRef = createNavigationContainerRef();

export function resetToAuth() {
  if (!navRef.isReady()) return;
  navRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Auth" as never }],
    })
  );
}
