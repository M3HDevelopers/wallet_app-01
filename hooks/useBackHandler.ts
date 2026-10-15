// Android hardware-back integration: route the system Back button through
// expo-router's navigation stack so Back / Home behave predictably.
// - Modal screens: back dismisses the modal.
// - Tab screens: first press goes to Home tab, second press exits the app.
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router } from 'expo-router';

/** Call while a screen is focused. `onBack` returning true means handled. */
export function useAndroidBack(onBack: () => boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => onBack());
    return () => sub.remove();
  });
}

/** Default behavior for non-home screens: pop/dismiss via the router. */
export function useDefaultBack() {
  useAndroidBack(() => {
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    return false;
  });
}

/** Tabs layout: Back returns to Home tab; pressing again exits the app. */
export function useTabsBackHandler(isHomeFocused: boolean) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isHomeFocused) {
        router.navigate('/(tabs)'); // go Home tab first
        return true;
      }
      return false; // on Home, let the OS background/exit the app
    });
    return () => sub.remove();
  }, [isHomeFocused]);
}
