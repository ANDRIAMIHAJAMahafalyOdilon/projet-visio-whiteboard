import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LobbyScreen from '@/screens/LobbyScreen';
import MeetingRoomScreen from '@/screens/MeetingRoomScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                    <Stack.Screen name="Lobby" component={LobbyScreen} />
                    <Stack.Screen name="MeetingRoom" component={MeetingRoomScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}