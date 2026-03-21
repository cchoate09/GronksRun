import { useEffect, useRef, useCallback, Component } from 'react';
import { View, StyleSheet, BackHandler, Text, Vibration, Share, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  RewardedInterstitialAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import gameHtml from './gameHtml';

const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED_INTERSTITIAL
  : 'ca-app-pub-8879184280264151/6328191159';

// Pre-load the rewarded interstitial ad
const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: true,
});

// ============================================================
// Error Boundary — catches React Native crashes and shows
// a recovery screen instead of a white screen
// ============================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crash caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <Text
            style={styles.errorRetry}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            TAP TO RETRY
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// Main App Component
// ============================================================
function GameApp() {
  const webViewRef = useRef(null);
  const adLoadedRef = useRef(false);
  const pendingRewardType = useRef(null);

  // Send message to WebView
  const sendToGame = useCallback((type, data) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type, ...data }));
    }
  }, []);

  // Load an ad
  const loadAd = useCallback(() => {
    adLoadedRef.current = false;
    try {
      rewardedInterstitial.load();
    } catch (e) {
      console.log('Ad load error:', e);
    }
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );

    // Android hardware back button — forward to WebView game
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      sendToGame('backButton', {});
      return true; // prevent default (app exit)
    });

    // Ad event listeners
    const onAdLoaded = rewardedInterstitial.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        adLoadedRef.current = true;
        sendToGame('adReady', { ready: true });
      }
    );

    const onAdEarned = rewardedInterstitial.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        // User watched the ad and earned the reward
        sendToGame('adRewarded', {
          rewardType: pendingRewardType.current,
          amount: reward.amount,
        });
        pendingRewardType.current = null;
      }
    );

    const onAdClosed = rewardedInterstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        // Ad was closed — preload the next one
        sendToGame('adClosed', {});
        loadAd();
      }
    );

    const onAdError = rewardedInterstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.log('Ad error:', error);
        adLoadedRef.current = false;
        sendToGame('adError', { message: error.message });
        // Retry after a delay
        setTimeout(loadAd, 30000);
      }
    );

    // Start loading the first ad
    loadAd();

    return () => {
      backHandler.remove();
      onAdLoaded();
      onAdEarned();
      onAdClosed();
      onAdError();
    };
  }, [loadAd, sendToGame]);

  // Handle messages from WebView
  const onMessage = useCallback(async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'showAd') {
        pendingRewardType.current = msg.rewardType || 'generic';
        if (adLoadedRef.current) {
          rewardedInterstitial.show();
        } else {
          sendToGame('adNotReady', {});
          loadAd();
        }
      } else if (msg.type === 'checkAd') {
        sendToGame('adReady', { ready: adLoadedRef.current });
      } else if (msg.type === 'exitApp') {
        // Game sent exit request (back button at main menu)
        BackHandler.exitApp();
      } else if (msg.type === 'share') {
        // Social sharing from game
        try {
          await Share.share({
            message: msg.text || "Check out Gronk's Run!",
          });
        } catch (e) {
          console.log('Share error:', e);
        }
      } else if (msg.type === 'rateApp') {
        // Open Play Store listing for rating
        try {
          await Linking.openURL('market://details?id=com.gronksrun.app');
        } catch (e) {
          // Fallback to web Play Store
          try {
            await Linking.openURL('https://play.google.com/store/apps/details?id=com.gronksrun.app');
          } catch (e2) {
            console.log('Could not open Play Store:', e2);
          }
        }
      } else if (msg.type === 'haptic') {
        // Vibration feedback from game events
        const p = msg.pattern;
        if (Array.isArray(p)) {
          Vibration.vibrate(p);
        } else if (p === 'light') {
          Vibration.vibrate(10);
        } else if (p === 'medium') {
          Vibration.vibrate(25);
        } else if (p === 'heavy') {
          Vibration.vibrate(50);
        } else {
          Vibration.vibrate(15);
        }
      }
    } catch (e) {
      console.log('Message parse error:', e);
    }
  }, [sendToGame, loadAd]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <WebView
        ref={webViewRef}
        source={{ html: gameHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        scalesPageToFit={true}
        originWhitelist={['*']}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
        androidLayerType="hardware"
        onError={(syntheticEvent) => {
          console.log('WebView error:', syntheticEvent.nativeEvent);
        }}
        onRenderProcessGone={(syntheticEvent) => {
          console.log('WebView process gone:', syntheticEvent.nativeEvent);
          // WebView crashed — reload it
          if (webViewRef.current) {
            webViewRef.current.reload();
          }
        }}
      />
    </View>
  );
}

// ============================================================
// Export wrapped in ErrorBoundary
// ============================================================
export default function App() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a1628',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    color: '#FF6644',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorMessage: {
    color: '#AABBCC',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'monospace',
  },
  errorRetry: {
    color: '#44DD66',
    fontSize: 20,
    fontWeight: 'bold',
    padding: 16,
    borderWidth: 2,
    borderColor: '#44DD66',
    borderRadius: 8,
  },
});
