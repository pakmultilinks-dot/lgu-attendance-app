import { registerRootComponent } from 'expo';
import App from './App';

// Entry point for the app. Without this file the bundle loads App.tsx
// but nothing registers the root component, so the app renders a blank
// screen on web (and the same entry is used for the Android build).
// package.json "main" points here.
registerRootComponent(App);
