import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Where is the backend API?
//
// The .NET backend runs on your computer at port 5167. Which host string your
// app must use depends on where the app is running:
//
//   • iOS simulator      → http://localhost:5167   (shares your Mac's network)
//   • Android emulator   → http://10.0.2.2:5167    (10.0.2.2 = host loopback)
//   • Physical phone     → http://<your-LAN-IP>:5167  (e.g. http://192.168.1.42:5167)
//                          Find it with `ipconfig` (Windows) / `ifconfig` (mac/linux).
//                          Phone and computer must be on the same Wi-Fi.
//
// If you're testing on a real device, set API_HOST_OVERRIDE below to your
// computer's LAN IP. Leave it null to auto-pick for the simulator/emulator.
// ---------------------------------------------------------------------------

const API_HOST_OVERRIDE = 'http://192.168.8.238:5167'; // e.g. 'http://192.168.1.42:5167'

const DEV_HOST = Platform.select({
  android: 'http://10.0.2.2:5167',
  ios: 'http://localhost:5167',
  default: 'http://localhost:5167',
});

export const API_BASE_URL = API_HOST_OVERRIDE ?? DEV_HOST;
