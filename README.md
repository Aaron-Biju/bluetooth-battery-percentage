# Bluetooth Battery Percentage Indicator

A lightweight, premium GNOME Shell extension for Linux (Ubuntu/Debian) that displays the battery percentage of connected Bluetooth and UPower devices (headphones, headsets, keyboards, mice, etc.) right next to the system menu in the top panel.

Designed to sit neatly next to the Bluetooth/status icons, it updates dynamically using D-Bus and UPower notifications with zero polling overhead.

---

## ✨ Features

- **Device-Specific Icons**: Auto-detects device classes and shows relevant emojis:
  - 🎧 Headphones / Headsets
  - 🖱️ Mice / Touchpads
  - ⌨️ Keyboards
  - ⌚ Smartwatches / Wearables
  - 🎮 Game controllers
  - 📱 Phones / Tablets
  - 🔋 Generic battery indicator
- **Real-Time Dynamic Updates**: Listens to system D-Bus signals for `DeviceAdded`, `DeviceRemoved`, and `PropertiesChanged` events via UPower, ensuring instant UI updates without burning CPU cycles.
- **Clean Layout**: Cleanly formatted badge with bold font and subtle padding to integrate with standard GNOME Shell panels.
- **Easy Installation**: Comes with a customized shell installer script that handles path setup and activation logic.

---

## 📂 File Structure

The project consists of the following components:

| File | Description |
| :--- | :--- |
| [extension.js] | Core GNOME Shell extension logic, managing D-Bus listeners and UI rendering. |
| [metadata.json] | Extension configuration metadata containing UUID and compatible GNOME version. |
| [install.sh] | Interactive installer script with colorized console output to set up and enable the extension. |
| [LICENSE] | MIT License terms. |
| [README.md] | User documentation and setup guide. |

---

## 🚀 Installation & Setup

Follow these simple steps to install and enable the extension:

### 1. Clone the Repository
Download or clone the files to your local machine:
```bash
git clone https://github.com/<your-username>/bluetooth-battery-percentage.git
cd bluetooth-battery-percentage
```

### 2. Run the Installer
The provided setup script automates the installation by copying files to the appropriate GNOME local extension directory and enabling the module:
```bash
chmod +x install.sh
./install.sh
```

### 3. Activate the Extension
Depending on your windowing system:

> [!IMPORTANT]
> **Wayland Sessions (Default on modern Ubuntu)**
> GNOME Shell cannot be hot-reloaded under Wayland. You **must log out of your current desktop session and log back in** to initialize and activate the extension.

> [!TIP]
> **X11 / Xorg Sessions**
> You can restart GNOME Shell directly without logging out:
> Press `Alt + F2`, type `r`, and press `Enter`.

---

## 🛠️ Diagnostics & Customization

### Checking Connected Devices
The extension queries the system `UPower` D-Bus service. To check what battery devices are currently visible to your system, run:
```bash
upower --dump
```
If your Bluetooth device is listed with a `percentage` field under UPower, it will be automatically picked up and displayed by this widget.

### Modifying Icons
You can change the icons displayed for different device types by editing the `DEVICE_ICONS` map at the top of [extension.js](file:///home/aaron.biju@acsiatech.com/Documents/bluetooth-battery-percentage/extension.js#L5-L19):
```javascript
const DEVICE_ICONS = {
    5: '🖱️',   // Mouse
    17: '🎧',  // Headset
    19: '🎧',  // Headphones
    // Add or change mappings here
};
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE] for details.
