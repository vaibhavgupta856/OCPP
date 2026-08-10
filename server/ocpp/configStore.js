/**
 * OCPP Configuration key store (GetConfiguration / ChangeConfiguration)
 */

const DEFAULTS = {
  HeartbeatInterval: '60',
  MeterValueSampleInterval: '10',
  MeterValuesSampledData: 'Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage,SoC',
  MeterValuesAlignedData: 'Energy.Active.Import.Register',
  ClockAlignedDataInterval: '0',
  AuthorizeRemoteTxRequests: 'true',
  LocalAuthorizeOffline: 'true',
  LocalPreAuthorize: 'false',
  AllowOfflineTxForUnknownId: 'false',
  StopTransactionOnEVSideDisconnect: 'true',
  StopTransactionOnInvalidId: 'true',
  UnlockConnectorOnEVSideDisconnect: 'true',
  ConnectionTimeOut: '60',
  ResetRetries: '3',
  BlinkRepeat: '0',
  LightIntensity: '100',
  MaxEnergyOnInvalidId: '0',
  SupportedFeatureProfiles: 'Core,LocalAuthListManagement,Reservation,RemoteTrigger,SmartCharging',
  NumberOfConnectors: '1',
  ConnectorPhaseRotation: 'NotApplicable',
  GetConfigurationMaxKeys: '50',
  LocalAuthListEnabled: 'true',
  LocalAuthListMaxLength: '100',
  SendLocalListMaxLength: '20',
  ReserveConnectorZeroSupported: 'false',
  ChargeProfileMaxStackLevel: '3',
  ChargingScheduleAllowedChargingRateUnit: 'Current,Power',
  ChargingScheduleMaxPeriods: '24',
  MaxChargingProfilesInstalled: '10',
  WebSocketPingInterval: '50',
  AuthorizationCacheEnabled: 'true',
};

export class ConfigStore {
  constructor(overrides = {}) {
    this.keys = { ...DEFAULTS, ...overrides };
    this.readonly = new Set([
      'SupportedFeatureProfiles',
      'NumberOfConnectors',
      'GetConfigurationMaxKeys',
      'ChargeProfileMaxStackLevel',
      'ChargingScheduleAllowedChargingRateUnit',
      'ChargingScheduleMaxPeriods',
      'MaxChargingProfilesInstalled',
      'LocalAuthListMaxLength',
      'SendLocalListMaxLength',
    ]);
  }

  get(keys) {
    const known = [];
    const unknown = [];
    const wanted = !keys || keys.length === 0 ? Object.keys(this.keys) : keys;

    for (const key of wanted) {
      if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
        known.push({
          key,
          readonly: this.readonly.has(key),
          value: this.keys[key],
        });
      } else {
        unknown.push(key);
      }
    }
    return { configurationKey: known, unknownKey: unknown };
  }

  change(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.keys, key)) {
      return 'NotSupported';
    }
    if (this.readonly.has(key)) {
      return 'Rejected';
    }
    this.keys[key] = String(value);
    return 'Accepted';
  }

  getNumber(key, fallback = 0) {
    const n = Number(this.keys[key]);
    return Number.isFinite(n) ? n : fallback;
  }

  getBool(key, fallback = false) {
    const v = this.keys[key];
    if (v === undefined) return fallback;
    return String(v).toLowerCase() === 'true';
  }

  snapshot() {
    return { ...this.keys };
  }
}
