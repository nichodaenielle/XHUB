# XHUB Mobile App

React Native mobile application for XHUB messaging platform.

## Setup

```bash
# Install dependencies
npm install

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

- **Framework**: React Native with Expo
- **Navigation**: React Navigation
- **State Management**: Zustand
- **API**: Axios
- **Real-time**: Socket.IO Client

## Project Structure

```
src/
├── screens/
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   └── ChatScreen.tsx
├── navigation/
│   └── AppNavigator.tsx
├── services/
│   └── api.ts
├── store/
│   └── auth.store.ts
└── components/
    └── ...
```

## Authentication

Uses the same RECAP credential validation as the web app via `/api/auth/login-recap`.

## API Configuration

Set `API_BASE_URL` in `.env` to point to the XHUB backend.
