# SecureChat User Manual (Brief)

## What SecureChat Does
SecureChat is a privacy-focused messaging app with:
- End-to-end encrypted messages
- Real-time chat updates
- Audio call and video call support
- In-app games feature
- Session-based identity (no traditional username/password profile)
- Local key management and key rotation support
- PIN lock for app access

## Main Functionality

### 1. First Login (Required)
- When a new user opens the app, they are asked to create a 6-digit PIN.
- After creating the PIN, a Recovery Code is shown. The user should copy or download/save it before continuing.
- After this step, the user is logged into the app interface.
- The app generates and stores encryption keys on the device.

### 2. Connect With Another User
- Go to Settings and copy your `SessionId` (unique for each device), or open the QR code so another user can scan it.
- The other user sends a chat request using your `SessionId`.
- Chat starts only after the recipient approves the request.
- Once approved, both users can initiate and exchange encrypted messages.

### 3. Receive Messages in Real Time
- New messages arrive instantly while connected.
- The app decrypts messages locally for display.

### 4. Manage Security
- Change your app PIN lock from Settings.
- If PIN is forgotten, use `Forgot PIN?` on the lock screen and enter the Recovery Code to reset it.
- Use key rotation options in the Security Center when needed.
- You can view and copy your Recovery Code from Recovery settings.

### 5. Clear Data
- Users can clear all local app data from Settings.
- On web, the app automatically refreshes after successful clear.

### 6. Audio/Video Calls
- Users can start audio calls and video calls from the chat interface.
- Audio and video calls are subject to proper internet connectivity for stable quality.

### 7. Games
- Users can access and play in-app games.
- Game performance and responsiveness may vary based on device and network conditions.

