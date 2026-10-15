// Root layout: providers + stack. All routes guarded by AuthProvider modal gate.
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../hooks/useAppContext';
import { AuthProvider } from '../features/auth/AuthContext';
import { colors } from '../utils/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add-money" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="borrow" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="repay" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="debts" />
              <Stack.Screen name="tx-details" />
              <Stack.Screen name="edit-tx" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="setup-balance" options={{ gestureEnabled: false }} />
            </Stack>
          </AuthProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
