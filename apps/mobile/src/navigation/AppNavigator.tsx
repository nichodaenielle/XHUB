import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/auth.store';

export default function AppNavigator() {
  const { accessToken, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="chat/[id]" />
    </Stack>
  );
}
