import { useEffect, useRef, useCallback, useState, Component } from 'react';
import { View, StyleSheet, BackHandler, Text, Vibration, AppState, Dimensions, PanResponder } from 'react-native';
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
import gameHtml from './assets/gameHtml';

import {
  bootstrapTelemetry,
  captureError,
  initializeTelemetry,
} from './src/telemetry';

bootstrapTelemetry();

const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED_INTERSTITIAL
  : 'ca-app-pub-8879184280264151/6328191159';

const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: true,
});

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
          <Text style={styles.errorMessage}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={styles.errorRetry} onPress={() => this.setState({ hasError: false, error: null })}>TAP TO RETRY</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function GameApp() {
  const webViewRef = useRef(null);
  const adLoadedRef = useRef(false);
  const pendingRewardType = useRef(null);
  const appStateRef = useRef(AppState.currentState || 'active');
  const adRetryTimerRef = useRef(null);

  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [showGameControls, setShowGameControls] = useState(false);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });

  const sendToGame = useCallback((type, data) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type, ...data }));
    }
  }, []);

  const sendWindowMetrics = useCallback(() => {
    const window = Dimensions.get('window');
    sendToGame('windowMetrics', {
      width: window.width,
      height: window.height,
      scale: window.scale || 1,
    });
  }, [sendToGame]);

  const loadAd = useCallback(() => {
    adLoadedRef.current = false;
    try {
      rewardedInterstitial.load();
    } catch (e) {
      console.log('Ad load error:', e);
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const dist = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const maxDist = 40;
        const moveX = Math.min(dist, maxDist) * (gestureState.dx / dist || 0);
        const moveY = Math.min(dist, maxDist) * (gestureState.dy / dist || 0);
        setJoystick({ x: moveX, y: moveY });
        sendToGame('joystickMove', { x: moveX / maxDist, y: moveY / maxDist });
      },
      onPanResponderRelease: () => {
        setJoystick({ x: 0, y: 0 });
        sendToGame('joystickMove', { x: 0, y: 0 });
      },
      // Allow simultaneous taps on the action buttons (jump/melee/ranged/pause)
      // while the joystick is being dragged. Defaults to true on Android, which
      // absorbs sibling Views' touch events and blocks multi-touch gameplay.
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  const handleAction = (action) => {
    Vibration.vibrate(10);
    sendToGame('action', { name: action });
  };

  useEffect(() => {
    void initializeTelemetry();
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      sendToGame('backButton', {});
      return true;
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      sendToGame('appState', { state: nextState, previousState: prevState });
      if (nextState === 'active') {
        sendWindowMetrics();
        if (!adLoadedRef.current) loadAd();
      }
    });

    const dimensionsSub = Dimensions.addEventListener('change', sendWindowMetrics);

    const onAdLoaded = rewardedInterstitial.addAdEventListener(RewardedAdEventType.LOADED, () => {
      adLoadedRef.current = true;
      sendToGame('adReady', { ready: true });
    });

    const onAdEarned = rewardedInterstitial.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
      // Some AdMob mediation paths fire EARNED_REWARD more than once for a
      // single view. Capture and null pendingRewardType atomically so a
      // duplicate fire is silently dropped instead of granting a 2x reward.
      const rewardType = pendingRewardType.current;
      if (!rewardType) return;
      pendingRewardType.current = null;
      sendToGame('adRewarded', { rewardType, amount: reward.amount });
    });

    const onAdClosed = rewardedInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
      sendToGame('adClosed', {});
      loadAd();
    });

    const onAdError = rewardedInterstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log('Ad error:', error);
      adLoadedRef.current = false;
      const code = error?.code || error?.nativeErrorCode || 'unknown';
      const message = error?.message || error?.nativeErrorMessage || String(error);
      sendToGame('adError', { code, message });
      void captureError(error instanceof Error ? error : new Error(message), {
        source: 'rewarded_ad_error',
        ad_error_code: String(code),
      });
      if (adRetryTimerRef.current != null) clearTimeout(adRetryTimerRef.current);
      adRetryTimerRef.current = setTimeout(() => {
        adRetryTimerRef.current = null;
        loadAd();
      }, 30000);
    });

    loadAd();

    return () => {
      backHandler.remove();
      appStateSub.remove();
      dimensionsSub.remove();
      onAdLoaded();
      onAdEarned();
      onAdClosed();
      onAdError();
      if (adRetryTimerRef.current != null) {
        clearTimeout(adRetryTimerRef.current);
        adRetryTimerRef.current = null;
      }
    };
  }, [loadAd, sendToGame, sendWindowMetrics]);

  const onMessage = useCallback(async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'showAd') {
        pendingRewardType.current = msg.rewardType || 'generic';
        if (adLoadedRef.current) rewardedInterstitial.show();
        else {
          sendToGame('adNotReady', {});
          loadAd();
        }
      } else if (msg.type === 'gameUiState') {
        setShowGameControls(msg.controlsVisible === true);
      } else if (msg.type === 'exitApp' || msg.type === 'safeToExit') BackHandler.exitApp();
      else if (msg.type === 'haptic') {
        const p = msg.pattern;
        if (Array.isArray(p)) Vibration.vibrate(p);
        else if (p === 'light') Vibration.vibrate(10);
        else if (p === 'medium') Vibration.vibrate(25);
        else if (p === 'heavy') Vibration.vibrate(50);
      }
    } catch (e) {}
  }, [sendToGame, loadAd]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <WebView
        ref={webViewRef}
        source={{ html: gameHtml, baseUrl: 'https://gronks-run.local/' }}
        style={[styles.webview, { opacity: webViewLoaded ? 1 : 0 }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={true}
        originWhitelist={['https://gronks-run.local']}
        scrollEnabled={false}
        onMessage={onMessage}
        androidLayerType="hardware"
        onLoadEnd={() => {
            console.log('WebView load finished');
            setWebViewLoaded(true);
            sendWindowMetrics();
        }}
        onError={(e) => {
            console.error('WebView error:', e.nativeEvent);
        }}
      />

      {!webViewLoaded && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>INITIALIZING ENGINE...</Text>
          <Text style={styles.loadingSubtext}>Booting WebGL Renderer...</Text>
        </View>
      )}

      {webViewLoaded && showGameControls && (
        <View style={styles.controlsLayer} pointerEvents="box-none">
            <View style={styles.topControlsContainer}>
                <View onTouchStart={() => handleAction('pause')} style={[styles.actionButton, styles.pauseButton]}>
                    <View style={styles.buttonShadow} />
                    <View style={[styles.buttonCore, styles.pauseCore]} />
                    <Text style={[styles.buttonGlyph, styles.pauseText]}>II</Text>
                </View>
            </View>

            <View style={styles.joystickContainer} {...panResponder.panHandlers}>
                <View style={styles.joystickBase}>
                    <View style={[styles.joystickStick, { transform: [{ translateX: joystick.x }, { translateY: joystick.y }] }]} />
                </View>
            </View>

            <View style={styles.actionButtonsContainer}>
                <View onTouchStart={() => handleAction('jump')} style={[styles.actionButton, styles.jumpButton]}>
                    <View style={styles.buttonShadow} />
                    <View style={[styles.buttonCore, styles.jumpCore]} />
                    <Text style={[styles.buttonGlyph, styles.jumpGlyph]}>^</Text>
                    <Text style={[styles.buttonLabel, styles.jumpText]}>JUMP</Text>
                </View>
                <View style={styles.combatButtonsRow}>
                    <View onTouchStart={() => handleAction('ranged')} style={[styles.actionButton, styles.rangedButton]}>
                        <View style={styles.buttonShadow} />
                        <View style={[styles.buttonCore, styles.rangedCore]} />
                        <Text style={[styles.buttonGlyph, styles.rangedGlyph]}>*</Text>
                        <Text style={[styles.buttonLabel, styles.rangedText]}>RANGED</Text>
                    </View>
                    <View onTouchStart={() => handleAction('attack')} style={[styles.actionButton, styles.attackButton]}>
                        <View style={styles.buttonShadow} />
                        <View style={[styles.buttonCore, styles.attackCore]} />
                        <Text style={[styles.buttonGlyph, styles.attackGlyph]}>X</Text>
                        <Text style={[styles.buttonLabel, styles.attackText]}>MELEE</Text>
                    </View>
                </View>
            </View>
        </View>
      )}
    </View>
  );
}

function AppRoot() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

export default Sentry.wrap(AppRoot);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a24' },
  loadingContainer: { position: 'absolute', inset: 0, backgroundColor: '#1a1a24', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#4488ff', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  loadingSubtext: { color: '#667788', fontSize: 12, marginTop: 8 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  controlsLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  topControlsContainer: { position: 'absolute', top: 12, right: 18, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  joystickContainer: { position: 'absolute', left: 28, bottom: 34, width: 150, height: 150, justifyContent: 'center', alignItems: 'center' },
  joystickBase: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  joystickStick: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.4)' },
  actionButtonsContainer: { position: 'absolute', right: 26, bottom: 32, alignItems: 'center', gap: 8 },
  combatButtonsRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  actionButton: { borderRadius: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.46)', overflow: 'visible' },
  buttonShadow: { position: 'absolute', left: 5, top: 6, right: -5, bottom: -6, borderRadius: 46, backgroundColor: 'rgba(2,6,23,0.55)' },
  buttonCore: { position: 'absolute', left: 4, top: 4, right: 4, bottom: 4, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  buttonGlyph: { color: '#ffffff', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  buttonLabel: { position: 'absolute', bottom: 13, color: '#ffffff', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  attackButton: { width: 88, height: 88, backgroundColor: 'rgba(122,21,28,0.52)', borderColor: '#ffd166' },
  attackCore: { backgroundColor: 'rgba(239,68,68,0.58)' },
  rangedButton: { width: 76, height: 76, backgroundColor: 'rgba(14,67,88,0.56)', borderColor: '#91e5ff' },
  rangedCore: { backgroundColor: 'rgba(14,165,233,0.5)' },
  jumpButton: { width: 72, height: 72, backgroundColor: 'rgba(21,97,61,0.54)', borderColor: '#bbf7d0' },
  jumpCore: { backgroundColor: 'rgba(34,197,94,0.48)' },
  pauseButton: { width: 44, height: 44, backgroundColor: 'rgba(52,42,101,0.55)', borderColor: '#ddd6fe' },
  pauseCore: { backgroundColor: 'rgba(124,58,237,0.46)' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  attackGlyph: { fontSize: 26, marginTop: -12 },
  rangedGlyph: { fontSize: 25, marginTop: -11 },
  jumpGlyph: { fontSize: 24, marginTop: -12 },
  attackText: { fontSize: 13 },
  rangedText: { fontSize: 10 },
  jumpText: { fontSize: 11 },
  pauseText: { fontSize: 18 },
  errorContainer: { flex: 1, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorTitle: { color: '#FF6644', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  errorMessage: { color: '#AABBCC', fontSize: 14, textAlign: 'center', marginBottom: 32, fontFamily: 'monospace' },
  errorRetry: { color: '#44DD66', fontSize: 20, fontWeight: 'bold', padding: 16, borderWidth: 2, borderColor: '#44DD66', borderRadius: 8 },
});
