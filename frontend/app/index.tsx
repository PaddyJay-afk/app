import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Import screens
import CustomersScreen from './screens/CustomersScreen';
import AddCustomerScreen from './screens/AddCustomerScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const theme = {
  colors: {
    primary: '#D4AF37', // Gold
    secondary: '#E8B4CB', // Rose Gold
    accent: '#8A2BE2', // Purple
    background: '#1A1A1A', // Dark background
    surface: '#2D2D2D', // Card/surface background
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#3D3D3D',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    tabBarActive: '#D4AF37',
    tabBarInactive: '#666666',
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer
        independent={true}
        theme={{
          dark: true,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.accent,
          }
        }}
      >
        <StatusBar style="light" backgroundColor={theme.colors.background} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap = 'help-circle';

              if (route.name === 'Customers') {
                iconName = focused ? 'people' : 'people-outline';
              } else if (route.name === 'Add Customer') {
                iconName = focused ? 'person-add' : 'person-add-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: theme.colors.tabBarActive,
            tabBarInactiveTintColor: theme.colors.tabBarInactive,
            tabBarStyle: {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              paddingBottom: Platform.OS === 'ios' ? 20 : 10,
              height: Platform.OS === 'ios' ? 85 : 65,
            },
            headerStyle: {
              backgroundColor: theme.colors.surface,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          })}
        >
          <Tab.Screen name="Customers" component={CustomersScreen} />
          <Tab.Screen name="Add Customer" component={AddCustomerScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
});