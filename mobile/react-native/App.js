/**
 * ROOTUIP React Native Mobile App
 * Cross-platform container tracking and management
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Platform
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import TouchID from 'react-native-touch-id';
import NetInfo from '@react-native-community/netinfo';

// Screens
import DashboardScreen from './screens/DashboardScreen';
import ContainerTrackingScreen from './screens/ContainerTrackingScreen';
import DocumentScanScreen from './screens/DocumentScanScreen';
import AlertsScreen from './screens/AlertsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import ContainerDetailScreen from './screens/ContainerDetailScreen';

// Components
import OfflineIndicator from './components/OfflineIndicator';
import BiometricAuth from './components/BiometricAuth';

// Context
import { AuthProvider } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Configure push notifications
PushNotification.configure({
  onRegister: function (token) {
    console.log('TOKEN:', token);
  },
  onNotification: function (notification) {
    console.log('NOTIFICATION:', notification);
    notification.finish();
  },
  permissions: {
    alert: true,
    badge: true,
    sound: true
  },
  popInitialNotification: true,
  requestPermissions: Platform.OS === 'ios'
});

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: styles.tabBar,
        headerStyle: {
          backgroundColor: '#0066CC',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        }
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Icon name="dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Tracking"
        component={ContainerTrackingScreen}
        options={{
          tabBarLabel: 'Track',
          tabBarIcon: ({ color, size }) => (
            <Icon name="location-on" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Scan"
        component={DocumentScanScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => (
            <Icon name="camera-alt" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Icon name="notifications" color={color} size={size} />
          ),
          tabBarBadge: 3 // Dynamic badge count
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Component
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    checkAuthStatus();
    
    // Monitor network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        // Verify token validity
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthentication = async () => {
    try {
      // Try biometric authentication first
      const biometryType = await TouchID.isSupported();
      
      if (biometryType) {
        const reason = 'Authenticate to access ROOTUIP';
        await TouchID.authenticate(reason);
        setIsAuthenticated(true);
      } else {
        // Fall back to regular login
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  if (isLoading) {
    return null; // Show splash screen
  }

  return (
    <AuthProvider value={{ isAuthenticated, setIsAuthenticated }}>
      <OfflineProvider value={{ isConnected }}>
        <SafeAreaView style={styles.container}>
          <StatusBar
            barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
            backgroundColor="#0066CC"
          />
          {!isConnected && <OfflineIndicator />}
          
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false
              }}
            >
              {!isAuthenticated ? (
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{
                    animationTypeForReplace: !isAuthenticated ? 'pop' : 'push',
                  }}
                />
              ) : (
                <>
                  <Stack.Screen name="Main" component={TabNavigator} />
                  <Stack.Screen
                    name="ContainerDetail"
                    component={ContainerDetailScreen}
                    options={{
                      headerShown: true,
                      headerTitle: 'Container Details',
                      headerStyle: {
                        backgroundColor: '#0066CC',
                      },
                      headerTintColor: '#fff',
                    }}
                  />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </OfflineProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    paddingTop: 5,
    height: Platform.OS === 'ios' ? 80 : 60,
  }
});