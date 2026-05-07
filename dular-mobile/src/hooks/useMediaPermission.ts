import * as ImagePicker from "expo-image-picker";

type PermissionResult = {
  granted: boolean;
  request: () => Promise<boolean>;
};

export function useMediaLibraryPermission(): PermissionResult {
  const request = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  return { granted: false, request };
}

export function useCameraPermission(): PermissionResult {
  const request = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  };

  return { granted: false, request };
}
