/**
 * Manual Jest mock for the IPC Bridge Service.
 *
 * The real module exports an `IPCBridgeService` class plus `getIPCBridge()` /
 * `resetIPCBridge()` helpers that hand out a singleton instance. Consumers call
 * `getIPCBridge().someMethod()`.
 *
 * This mock exposes one shared mock bridge whose methods are jest.fn(). The very
 * same jest.fn instances are ALSO re-exported as named functions, so integration
 * tests can configure behaviour either way and both point at the function the
 * component invokes:
 *
 *   (ipcBridgeService.getAvailableCores as jest.Mock).mockResolvedValue([...]);
 *   // or
 *   getIPCBridge().getAvailableCores.mockResolvedValue([...]);
 */

// Stable jest.fn instances. The `react` jest project enables resetMocks, which
// clears implementations between tests, so tests set their own behaviour; the
// identities here remain stable for the lifetime of the module.
export const startRecording = jest.fn();
export const stopRecording = jest.fn();
export const checkForRecordings = jest.fn();
export const getLatestRecording = jest.fn();
export const startPlayback = jest.fn();
export const stopPlayback = jest.fn();
export const pausePlayback = jest.fn();
export const setPlaybackSpeed = jest.fn();
export const setLoopCount = jest.fn();
export const setShowPreview = jest.fn();
export const setPreviewOpacity = jest.fn();
export const setSelectedScriptPath = jest.fn();
export const getAvailableCores = jest.fn();
export const getCoreStatus = jest.fn();
export const selectCore = jest.fn();
export const getCorePerformanceMetrics = jest.fn();
export const getPerformanceComparison = jest.fn();
export const listScripts = jest.fn();
export const loadScript = jest.fn();
export const saveScript = jest.fn();
export const deleteScript = jest.fn();
export const loadAsset = jest.fn();
export const saveAsset = jest.fn();
export const deleteAsset = jest.fn();
export const revealInFinder = jest.fn();
export const analyzeVision = jest.fn();
export const captureScreenshot = jest.fn();
export const captureVisionMarker = jest.fn();
export const invalidateVisionCache = jest.fn();
export const updateVisionCache = jest.fn();
export const getScreenDimensions = jest.fn();
export const getUserSettings = jest.fn();
export const updateUserSettings = jest.fn();
export const addEventListener = jest.fn();
export const removeEventListener = jest.fn();
export const terminate = jest.fn();

// The shared mock bridge: methods ARE the named-export jest.fns above.
const bridge = {
  startRecording,
  stopRecording,
  checkForRecordings,
  getLatestRecording,
  startPlayback,
  stopPlayback,
  pausePlayback,
  setPlaybackSpeed,
  setLoopCount,
  setShowPreview,
  setPreviewOpacity,
  setSelectedScriptPath,
  getAvailableCores,
  getCoreStatus,
  selectCore,
  getCorePerformanceMetrics,
  getPerformanceComparison,
  listScripts,
  loadScript,
  saveScript,
  deleteScript,
  loadAsset,
  saveAsset,
  deleteAsset,
  revealInFinder,
  analyzeVision,
  captureScreenshot,
  captureVisionMarker,
  invalidateVisionCache,
  updateVisionCache,
  getScreenDimensions,
  getUserSettings,
  updateUserSettings,
  addEventListener,
  removeEventListener,
  terminate,
};

export class IPCBridgeService {
  constructor() {
    return bridge as unknown as IPCBridgeService;
  }
}

// Plain functions (NOT jest.fn) so the `react` project's resetMocks:true cannot
// strip their implementation between tests — components rely on getIPCBridge()
// returning the bridge during render. Tests that want their OWN bridge should
// configure the shared bridge's methods (the named exports) rather than trying
// to call getIPCBridge.mockReturnValue (it is not a jest.fn).
export const getIPCBridge = () => bridge;
export const resetIPCBridge = () => {};

export default bridge;
