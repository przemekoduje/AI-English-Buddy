import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import React, { useEffect } from 'react';

export default function RootLayout() {
  // Dynamiczne wykrywanie powrotu do ekranu desktopowego (szerokość >= 768px na urządzeniu innym niż smartfon)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let resizeTimer: any = null;
    let isRedirecting = false;

    const checkDesktopRedirect = () => {
      if (isRedirecting) return;
      try {
        const isPhoneDevice = /Mobi|Android.*Mobile|iPhone|iPod/i.test(navigator.userAgent) || 
                              (window.screen && Math.min(window.screen.width, window.screen.height) <= 500);
        
        if (!isPhoneDevice && window.innerWidth >= 768) {
          const path = window.location.pathname;
          if (path.startsWith('/speakling/mobile') || path.startsWith('/mobile')) {
            isRedirecting = true;
            const searchParams = new URLSearchParams(window.location.search);
            searchParams.delete('cb');
            searchParams.set('cb', String(Date.now()));
            const query = searchParams.toString();
            const queryStr = query ? ('?' + query) : '';
            const target = window.location.origin + '/speakling' + queryStr + window.location.hash;
            window.location.replace(target);
          }
        }
      } catch (e) {
        console.error('Desktop redirect check failed:', e);
      }
    };

    checkDesktopRedirect();

    const handleResize = () => {
      clearTimeout(resizeTimer);
      if (window.innerWidth >= 768) {
        resizeTimer = setTimeout(checkDesktopRedirect, 80);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
});
