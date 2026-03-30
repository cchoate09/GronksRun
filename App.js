import { useEffect, useRef, useCallback, Component } from 'react';
import { View, StyleSheet, BackHandler, Text, Vibration, Share, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Sentry from '@sentry/react-native';
import {
  RewardedInterstitialAd,
  AdEventType,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import gameHtml from './gameHtml';
import {
  bootstrapTelemetry,
  captureError,
  captureMessage,
  initializeTelemetry,
  trackEvent,
} from './src/telemetry';

bootstrapTelemetry();

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
    void captureError(error, {
      source: 'native_error_boundary',
      component_stack: errorInfo?.componentStack || '',
    });
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
    void initializeTelemetry().then((status) => {
      return trackEvent('app_open', {
        analytics_configured: status.analyticsConfigured,
        crash_reporting_configured: status.crashReportingConfigured,
        source: 'native_shell',
      });
    }).catch((error) => {
      console.log('Telemetry init error:', error);
    });

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
        void trackEvent('rewarded_interstitial_loaded', {
          source: 'native_shell',
        });
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
        void trackEvent('rewarded_interstitial_rewarded', {
          amount: reward.amount,
          reward_type: pendingRewardType.current || 'generic',
          source: 'native_shell',
        });
        void trackEvent('ad_reward', {
          amount: reward.amount,
          reward_type: pendingRewardType.current || 'generic',
          source: 'native_shell',
        });
        pendingRewardType.current = null;
      }
    );

    const onAdClosed = rewardedInterstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        // Ad was closed — preload the next one
        sendToGame('adClosed', {});
        void trackEvent('rewarded_interstitial_closed', {
          source: 'native_shell',
        });
        loadAd();
      }
    );

    const onAdError = rewardedInterstitial.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.log('Ad error:', error);
        adLoadedRef.current = false;
        sendToGame('adError', { message: error.message });
        void trackEvent('rewarded_interstitial_error', {
          code: error.code || 'unknown',
          message: error.message || 'unknown',
          source: 'native_shell',
        });
        void captureMessage('Rewarded interstitial error', {
          ad_code: error.code || 'unknown',
          ad_message: error.message || 'unknown',
          source: 'native_shell',
        }, 'warning');
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
        void trackEvent('rewarded_interstitial_show_requested', {
          reward_type: pendingRewardType.current,
          source: 'webview_game',
        });
        if (adLoadedRef.current) {
          rewardedInterstitial.show();
        } else {
          sendToGame('adNotReady', {});
          void trackEvent('rewarded_interstitial_not_ready', {
            reward_type: pendingRewardType.current,
            source: 'native_shell',
          });
          loadAd();
        }
      } else if (msg.type === 'checkAd') {
        sendToGame('adReady', { ready: adLoadedRef.current });
      } else if (msg.type === 'exitApp') {
        // Game sent exit request (back button at main menu)
        void trackEvent('app_exit_requested', {
          source: 'webview_game',
        });
        BackHandler.exitApp();
      } else if (msg.type === 'share') {
        // Social sharing from game
        try {
          await Share.share({
            message: msg.text || "Check out Gronk's Run!",
          });
          void trackEvent('share_sheet_opened', {
            source: 'webview_game',
          });
        } catch (e) {
          console.log('Share error:', e);
          void captureError(e, {
            action: 'share',
            source: 'native_shell',
          });
        }
      } else if (msg.type === 'rateApp') {
        // Open Play Store listing for rating
        try {
          await Linking.openURL('market://details?id=com.gronksrun.app');
          void trackEvent('rate_app_opened', {
            source: 'webview_game',
            target: 'market',
          });
        } catch (e) {
          // Fallback to web Play Store
          try {
            await Linking.openURL('https://play.google.com/store/apps/details?id=com.gronksrun.app');
            void trackEvent('rate_app_opened', {
              source: 'webview_game',
              target: 'web_fallback',
            });
          } catch (e2) {
            console.log('Could not open Play Store:', e2);
            void captureError(e2, {
              action: 'rate_app',
              source: 'native_shell',
            });
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
      } else if (msg.type === 'analytics') {
        void trackEvent(msg.event, {
          ...(msg.params || {}),
          source: 'webview_game',
        });
      } else if (msg.type === 'crash') {
        // Crash report from WebView game loop
        console.error(`[GameCrash] ${msg.phase}: ${msg.message}`, {
          fps: msg.fps,
          particles: msg.particles,
          stack: msg.stack,
        });
        const error = new Error(msg.message || 'Unknown WebView crash');
        error.name = 'WebViewGameError';
        if (msg.stack) {
          error.stack = msg.stack;
        }
        void captureError(error, {
          fps: msg.fps,
          particles: msg.particles,
          phase: msg.phase || 'unknown',
          source: 'webview_game',
        });
      }
    } catch (e) {
      console.log('Message parse error:', e);
      void captureError(e, {
        source: 'native_shell',
        action: 'parse_webview_message',
      });
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
        onLoadStart={() => {
          void trackEvent('webview_load_started', {
            source: 'native_shell',
          });
        }}
        onLoadEnd={() => {
          void trackEvent('webview_load_finished', {
            source: 'native_shell',
          });
        }}
        onError={(syntheticEvent) => {
          console.log('WebView error:', syntheticEvent.nativeEvent);
          void trackEvent('webview_load_error', {
            description: syntheticEvent.nativeEvent?.description || 'unknown',
            source: 'native_shell',
          });
          void captureMessage('WebView load error', {
            description: syntheticEvent.nativeEvent?.description || 'unknown',
            source: 'native_shell',
            url: syntheticEvent.nativeEvent?.url || 'inline_html',
          }, 'error');
        }}
        onRenderProcessGone={(syntheticEvent) => {
          console.log('WebView process gone:', syntheticEvent.nativeEvent);
          void trackEvent('webview_process_gone', {
            did_crash: !!syntheticEvent.nativeEvent?.didCrash,
            renderer_priority: syntheticEvent.nativeEvent?.rendererPriorityAtExit || 'unknown',
            source: 'native_shell',
          });
          void captureMessage('WebView render process gone', {
            did_crash: !!syntheticEvent.nativeEvent?.didCrash,
            renderer_priority: syntheticEvent.nativeEvent?.rendererPriorityAtExit || 'unknown',
            source: 'native_shell',
          }, 'error');
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
function AppRoot() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(AppRoot);

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
