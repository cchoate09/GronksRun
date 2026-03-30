import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sentry from '@sentry/react-native';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
const expoConfig = Constants.expoConfig || {};
const telemetryDefaults = (expoConfig.extra && expoConfig.extra.telemetry) || {};
const platformConstants = Platform.constants || {};
const appVersion = expoConfig.version || '0.0.0';
const buildNumber = String(
  (Platform.OS === 'android' && expoConfig.android && expoConfig.android.versionCode) ||
  (Platform.OS === 'ios' && expoConfig.ios && expoConfig.ios.buildNumber) ||
  telemetryDefaults.buildNumber ||
  'dev'
);
const appSlug = expoConfig.slug || 'gronks-run';
const releaseName = `${appSlug}@${appVersion}+${buildNumber}`;
const sessionId = makeId('session');
const installStatePath = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}gronks-run-telemetry.json`
  : null;

const config = {
  enabled: parseFlag(process.env.EXPO_PUBLIC_TELEMETRY_ENABLED, telemetryDefaults.enabled, true),
  analyticsEnabled: parseFlag(process.env.EXPO_PUBLIC_ANALYTICS_ENABLED, telemetryDefaults.analyticsEnabled, true),
  crashReportingEnabled: parseFlag(
    process.env.EXPO_PUBLIC_CRASH_REPORTING_ENABLED,
    telemetryDefaults.crashReportingEnabled,
    true
  ),
  environment: (
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ||
    telemetryDefaults.environment ||
    (isDev ? 'development' : 'production')
  ),
  sentryDsn: (
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    telemetryDefaults.sentryDsn ||
    ''
  ).trim(),
  posthogApiKey: (
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY ||
    telemetryDefaults.posthogApiKey ||
    ''
  ).trim(),
  posthogHost: normalizeHost(
    process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    telemetryDefaults.posthogHost ||
    'https://us.i.posthog.com'
  ),
};

let installId = null;
let installLoaded = false;
let initializePromise = null;
let sentryBootstrapped = false;

function parseFlag(...values) {
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
      if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
  }
  return false;
}

function normalizeHost(host) {
  return String(host || 'https://us.i.posthog.com').replace(/\/+$/, '');
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBaseContext() {
  return {
    app_version: appVersion,
    build_number: buildNumber,
    device_brand: platformConstants.Brand || platformConstants.brand || 'unknown',
    device_model: platformConstants.Model || platformConstants.model || 'unknown',
    environment: config.environment,
    execution_environment: Constants.executionEnvironment || 'unknown',
    install_id: installId || 'pending_install_id',
    os_version: Platform.Version,
    platform: Platform.OS,
    release: releaseName,
    runtime: 'native_webview_shell',
    session_id: sessionId,
  };
}

function sanitizeValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeValue);
  }
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalized = sanitizeValue(nestedValue);
      if (normalized !== undefined) sanitized[key] = normalized;
    }
    return sanitized;
  }
  return String(value);
}

function sanitizePayload(payload) {
  const sanitized = {};
  for (const [key, value] of Object.entries(payload || {})) {
    const normalized = sanitizeValue(value);
    if (normalized !== undefined) sanitized[key] = normalized;
  }
  return sanitized;
}

function canUseSentry() {
  return config.enabled && config.crashReportingEnabled && !!config.sentryDsn;
}

function canUsePostHog() {
  return config.enabled && config.analyticsEnabled && !!config.posthogApiKey;
}

export function bootstrapTelemetry() {
  if (sentryBootstrapped || !canUseSentry()) return;

  Sentry.init({
    dsn: config.sentryDsn,
    enabled: true,
    environment: config.environment,
    release: releaseName,
    dist: buildNumber,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: isDev ? 1.0 : 0.2,
  });

  sentryBootstrapped = true;
  Sentry.setTags({
    app_version: appVersion,
    build_number: buildNumber,
    environment: config.environment,
    platform: Platform.OS,
    runtime: 'native_webview_shell',
  });
}

async function loadInstallId() {
  if (installLoaded) return installId;
  installLoaded = true;

  if (!installStatePath || !FileSystem.readAsStringAsync || !FileSystem.writeAsStringAsync) {
    installId = makeId('install');
    return installId;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(installStatePath);
    const parsed = JSON.parse(raw);
    if (parsed && parsed.installId) {
      installId = parsed.installId;
      return installId;
    }
  } catch (error) {
    if (isDev) {
      console.log('[Telemetry] No persisted install id found yet.');
    }
  }

  installId = makeId('install');
  try {
    await FileSystem.writeAsStringAsync(installStatePath, JSON.stringify({
      createdAt: new Date().toISOString(),
      installId,
    }));
  } catch (error) {
    if (isDev) {
      console.log('[Telemetry] Failed to persist install id:', error);
    }
  }
  return installId;
}

export async function initializeTelemetry() {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    bootstrapTelemetry();
    await loadInstallId();

    if (sentryBootstrapped && installId) {
      Sentry.setUser({ id: installId });
      Sentry.setContext('runtime', getBaseContext());
    }

    return getTelemetryStatus();
  })();

  return initializePromise;
}

async function sendPostHogEvent(eventName, params) {
  if (!canUsePostHog()) return false;

  const payload = {
    api_key: config.posthogApiKey,
    distinct_id: installId || makeId('fallback'),
    event: eventName,
    properties: {
      ...getBaseContext(),
      ...sanitizePayload(params),
      $process_person_profile: false,
    },
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(`${config.posthogHost}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed with status ${response.status}`);
  }

  return true;
}

export async function trackEvent(eventName, params = {}) {
  if (!eventName || !config.enabled || !config.analyticsEnabled) return false;

  await initializeTelemetry();
  const payload = sanitizePayload(params);

  if (isDev) {
    console.log(`[Telemetry] ${eventName}`, payload);
  }

  if (sentryBootstrapped) {
    Sentry.addBreadcrumb({
      category: 'analytics',
      data: payload,
      level: 'info',
      message: eventName,
    });
  }

  try {
    return await sendPostHogEvent(eventName, payload);
  } catch (error) {
    if (isDev) {
      console.log('[Telemetry] Analytics delivery failed:', error);
    }

    if (sentryBootstrapped) {
      Sentry.withScope((scope) => {
        scope.setLevel('warning');
        scope.setTag('telemetry_event', eventName);
        scope.setExtra('analytics_failure', {
          event_name: eventName,
          payload,
          posthog_host: config.posthogHost,
        });
        Sentry.captureMessage('Analytics delivery failed');
      });
    }
    return false;
  }
}

function setScopeContext(scope, context) {
  const payload = {
    ...getBaseContext(),
    ...sanitizePayload(context),
  };

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      scope.setTag(key, String(value));
    } else {
      scope.setExtra(key, value);
    }
  }
}

export async function captureError(error, context = {}) {
  await initializeTelemetry();
  bootstrapTelemetry();

  const normalized = error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : context.message || 'Unknown error');

  if (isDev) {
    console.error('[Telemetry] Captured error:', normalized, context);
  }

  if (sentryBootstrapped) {
    Sentry.withScope((scope) => {
      scope.setLevel('error');
      setScopeContext(scope, context);
      Sentry.captureException(normalized);
    });
  }

  return normalized;
}

export async function captureMessage(message, context = {}, level = 'warning') {
  await initializeTelemetry();
  bootstrapTelemetry();

  if (isDev) {
    console.log(`[Telemetry] ${level}: ${message}`, context);
  }

  if (sentryBootstrapped) {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      setScopeContext(scope, context);
      Sentry.captureMessage(message);
    });
  }
}

export function getTelemetryStatus() {
  return {
    analyticsConfigured: canUsePostHog(),
    crashReportingConfigured: canUseSentry(),
    enabled: config.enabled,
    environment: config.environment,
    installId: installId || null,
    releaseName,
    sessionId,
  };
}
