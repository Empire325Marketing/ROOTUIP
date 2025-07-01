/**
 * Biometric Authentication Component
 * Handles Face ID, Touch ID, and fingerprint authentication
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Alert
} from 'react-native';
import TouchID from 'react-native-touch-id';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import * as Keychain from 'react-native-keychain';

const BiometricAuth = ({ 
  onSuccess, 
  onFailure, 
  onCancel,
  fallbackToPassword = true,
  saveCredentials = true 
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const biometryType = await TouchID.isSupported();
      setBiometricType(biometryType);
      
      // Auto-trigger authentication if biometric is available
      if (biometryType) {
        setTimeout(() => authenticate(), 500);
      } else if (!fallbackToPassword) {
        onFailure?.('Biometric authentication not available');
      }
    } catch (error) {
      console.log('Biometric check error:', error);
      setBiometricType(null);
      
      if (!fallbackToPassword) {
        onFailure?.('Biometric authentication not available');
      }
    }
  };

  const authenticate = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    
    const optionalConfigObject = {
      title: 'Authentication Required',
      imageColor: '#0066CC',
      imageErrorColor: '#F44336',
      sensorDescription: 'Touch sensor',
      sensorErrorDescription: 'Failed',
      cancelText: 'Cancel',
      fallbackLabel: 'Use Password',
      unifiedErrors: false,
      passcodeFallback: fallbackToPassword
    };

    try {
      const biometryType = await TouchID.isSupported();
      
      if (biometryType) {
        const success = await TouchID.authenticate(
          `Sign in to ROOTUIP${biometryType === 'FaceID' ? ' with Face ID' : ''}`,
          optionalConfigObject
        );
        
        if (success) {
          // Retrieve stored credentials if available
          if (saveCredentials) {
            const credentials = await Keychain.getInternetCredentials('com.rootuip.mobile');
            if (credentials) {
              onSuccess?.(credentials);
            } else {
              onSuccess?.({});
            }
          } else {
            onSuccess?.({});
          }
          
          // Save successful authentication
          await AsyncStorage.setItem('lastAuthTime', new Date().toISOString());
          setAttempts(0);
        }
      }
    } catch (error) {
      console.log('Authentication error:', error);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      switch (error.code) {
        case 'UserCancel':
          if (fallbackToPassword) {
            setShowPasswordFallback(true);
          } else {
            onCancel?.();
          }
          break;
          
        case 'UserFallback':
          setShowPasswordFallback(true);
          break;
          
        case 'BiometryNotEnrolled':
          Alert.alert(
            'Biometric Not Set Up',
            'Please set up Face ID or Touch ID in your device settings',
            [
              { text: 'Cancel', onPress: () => onCancel?.() },
              { text: 'Settings', onPress: () => openSettings() }
            ]
          );
          break;
          
        case 'PasscodeNotSet':
          Alert.alert(
            'Passcode Required',
            'Please set up a passcode in your device settings',
            [{ text: 'OK', onPress: () => onCancel?.() }]
          );
          break;
          
        case 'BiometryLockout':
        case 'BiometryTemporaryLockout':
          Alert.alert(
            'Too Many Attempts',
            'Biometric authentication is locked. Please try again later or use your password.',
            [
              { text: 'Cancel', onPress: () => onCancel?.() },
              { text: 'Use Password', onPress: () => setShowPasswordFallback(true) }
            ]
          );
          break;
          
        default:
          if (newAttempts >= maxAttempts) {
            Alert.alert(
              'Authentication Failed',
              'Maximum attempts reached. Please use your password.',
              [
                { text: 'Cancel', onPress: () => onCancel?.() },
                { text: 'Use Password', onPress: () => setShowPasswordFallback(true) }
              ]
            );
          } else {
            // Retry
            setTimeout(() => authenticate(), 1000);
          }
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const getBiometricIcon = () => {
    if (Platform.OS === 'ios') {
      return biometricType === 'FaceID' ? 'face' : 'fingerprint';
    }
    return 'fingerprint';
  };

  const getBiometricText = () => {
    if (Platform.OS === 'ios') {
      return biometricType === 'FaceID' ? 'Face ID' : 'Touch ID';
    }
    return 'Fingerprint';
  };

  if (showPasswordFallback) {
    // In a real app, this would show your password screen
    return null;
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={() => onCancel?.()}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.background}
        >
          <View style={styles.authContainer}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#0066CC', '#004C99']}
                style={styles.logo}
              >
                <Text style={styles.logoText}>R</Text>
              </LinearGradient>
              <Text style={styles.appName}>ROOTUIP</Text>
            </View>

            {/* Biometric Icon */}
            <View style={styles.biometricIconContainer}>
              <Icon 
                name={getBiometricIcon()} 
                size={80} 
                color={isAuthenticating ? '#0066CC' : '#fff'} 
              />
              {isAuthenticating && (
                <ActivityIndicator 
                  style={styles.loader} 
                  size="large" 
                  color="#0066CC" 
                />
              )}
            </View>

            {/* Status Text */}
            <Text style={styles.statusText}>
              {isAuthenticating 
                ? `Authenticating with ${getBiometricText()}...` 
                : `Use ${getBiometricText()} to sign in`}
            </Text>

            {attempts > 0 && attempts < maxAttempts && (
              <Text style={styles.errorText}>
                Authentication failed. {maxAttempts - attempts} attempts remaining.
              </Text>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={authenticate}
                disabled={isAuthenticating}
              >
                <Icon name="refresh" size={20} color="#0066CC" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>

              {fallbackToPassword && (
                <TouchableOpacity
                  style={styles.passwordButton}
                  onPress={() => setShowPasswordFallback(true)}
                >
                  <Text style={styles.passwordButtonText}>Use Password Instead</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => onCancel?.()}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Security Note */}
            <View style={styles.securityNote}>
              <Icon name="lock" size={16} color="#666" />
              <Text style={styles.securityText}>
                Your biometric data is stored securely on your device
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// HOC for wrapping screens with biometric auth
export const withBiometricAuth = (WrappedComponent) => {
  return (props) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    
    const handleAuthSuccess = (credentials) => {
      setIsAuthenticated(true);
    };
    
    const handleAuthFailure = (error) => {
      Alert.alert('Authentication Failed', error);
    };
    
    const handleAuthCancel = () => {
      // Handle cancellation - maybe navigate back
    };
    
    if (!isAuthenticated) {
      return (
        <BiometricAuth
          onSuccess={handleAuthSuccess}
          onFailure={handleAuthFailure}
          onCancel={handleAuthCancel}
        />
      );
    }
    
    return <WrappedComponent {...props} />;
  };
};

// Quick authentication check utility
export const quickAuth = async () => {
  try {
    const biometryType = await TouchID.isSupported();
    if (!biometryType) return false;
    
    const success = await TouchID.authenticate('Verify your identity');
    return success;
  } catch (error) {
    return false;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxWidth: 350,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  biometricIconContainer: {
    position: 'relative',
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  loader: {
    position: 'absolute',
  },
  statusText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#0066CC',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  passwordButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  passwordButtonText: {
    color: '#0066CC',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    textAlign: 'center',
  },
});

export default BiometricAuth;