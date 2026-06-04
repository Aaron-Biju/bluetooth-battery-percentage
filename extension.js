const { GObject, St, Gio, GLib, Clutter } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const DEVICE_ICONS = {
    5: '🖱️',   // Mouse
    6: '⌨️',   // Keyboard
    8: '📱',   // Phone
    10: '📱',  // Tablet
    12: '🎮',  // Gaming Input/Controller
    13: '🖊️',  // Pen
    14: '🖲️',  // Touchpad
    17: '🎧',  // Headset
    18: '🔊',  // Speakers
    19: '🎧',  // Headphones
    20: '📷',  // Video / Camera
    21: '🎵',  // Other Audio
    26: '⌚',  // Wearable / Smartwatch
};

const HeadphoneBatteryIndicator = GObject.registerClass({
    GTypeName: 'HeadphoneBatteryIndicator'
}, class HeadphoneBatteryIndicator extends PanelMenu.Button {
    _init(uuid) {
        super._init(0.0, 'Headphone Battery Indicator');
        this._uuid = uuid;
        this._devices = {};
        this._signalIds = [];

        this.box = new St.BoxLayout({ 
            style_class: 'panel-status-menu-box',
            pack_start: true
        });
        
        this.label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-label'
        });
        
        // Bold text with subtle horizontal margins to fit cleanly beside the bluetooth icon
        this.label.set_style('font-weight: bold; margin-left: 6px; margin-right: 6px;');
        
        this.box.add_child(this.label);
        this.add_child(this.box);
        
        this.hide();

        this._initUPower();
    }

    _initUPower() {
        try {
            // Subscribe to DeviceAdded
            let addedId = Gio.DBus.system.signal_subscribe(
                'org.freedesktop.UPower',
                'org.freedesktop.UPower',
                'DeviceAdded',
                '/org/freedesktop/UPower',
                null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, path, interfaceName, signalName, parameters) => {
                    let [devicePath] = parameters.deepUnpack();
                    this._addDevice(devicePath);
                }
            );
            this._signalIds.push(addedId);

            // Subscribe to DeviceRemoved
            let removedId = Gio.DBus.system.signal_subscribe(
                'org.freedesktop.UPower',
                'org.freedesktop.UPower',
                'DeviceRemoved',
                '/org/freedesktop/UPower',
                null,
                Gio.DBusSignalFlags.NONE,
                (conn, sender, path, interfaceName, signalName, parameters) => {
                    let [devicePath] = parameters.deepUnpack();
                    this._removeDevice(devicePath);
                }
            );
            this._signalIds.push(removedId);

            // Enumerate existing devices
            let res = Gio.DBus.system.call_sync(
                'org.freedesktop.UPower',
                '/org/freedesktop/UPower',
                'org.freedesktop.UPower',
                'EnumerateDevices',
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
            let [devices] = res.deepUnpack();
            if (devices) {
                for (let devicePath of devices) {
                    this._addDevice(devicePath);
                }
            }
        } catch (e) {
            logError(e, '[HeadphoneBatteryIndicator] Failed to initialize UPower DBus listeners');
        }
    }

    _getProperty(devicePath, propertyName) {
        try {
            let res = Gio.DBus.system.call_sync(
                'org.freedesktop.UPower',
                devicePath,
                'org.freedesktop.DBus.Properties',
                'Get',
                GLib.Variant.new('(ss)', ['org.freedesktop.UPower.Device', propertyName]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );
            let [variant] = res.deepUnpack();
            return variant.recursiveUnpack();
        } catch (e) {
            return null;
        }
    }

    _addDevice(devicePath) {
        if (this._devices[devicePath]) {
            return;
        }

        try {
            let type = this._getProperty(devicePath, 'Type');
            let nativePath = this._getProperty(devicePath, 'NativePath');

            let isBluetoothAudio = false;
            // 17 = Headset, 18 = Speakers, 19 = Headphones, 20 = Audio device
            if (type === 17 || type === 18 || type === 19 || type === 20) {
                isBluetoothAudio = true;
            } else if (nativePath && (nativePath.includes('/org/bluez/') || nativePath.includes('bluez'))) {
                isBluetoothAudio = true;
            }

            if (isBluetoothAudio) {
                // Subscribe to properties changed on this device
                let signalId = Gio.DBus.system.signal_subscribe(
                    'org.freedesktop.UPower',
                    'org.freedesktop.DBus.Properties',
                    'PropertiesChanged',
                    devicePath,
                    null,
                    Gio.DBusSignalFlags.NONE,
                    () => {
                        this._updateDisplay();
                    }
                );

                this._devices[devicePath] = {
                    signalId: signalId
                };

                this._updateDisplay();
            }
        } catch (e) {
            logError(e, '[HeadphoneBatteryIndicator] Failed to add device: ' + devicePath);
        }
    }

    _removeDevice(devicePath) {
        let device = this._devices[devicePath];
        if (device) {
            try {
                Gio.DBus.system.signal_unsubscribe(device.signalId);
            } catch (e) {}
            delete this._devices[devicePath];
            this._updateDisplay();
        }
    }

    _updateDisplay() {
        let displayTexts = [];
        for (let devicePath in this._devices) {
            let percentage = this._getProperty(devicePath, 'Percentage');
            let type = this._getProperty(devicePath, 'Type');

            if (percentage !== null && percentage !== undefined && percentage > 0) {
                let icon = DEVICE_ICONS[type] || '🔋';
                displayTexts.push(`${icon} ${Math.round(percentage)}%`);
            }
        }

        if (displayTexts.length > 0) {
            this.label.set_text(displayTexts.join(' | '));
            this.show();
        } else {
            this.label.set_text('');
            this.hide();
        }
    }

    destroy() {
        // Disconnect all devices
        for (let devicePath in this._devices) {
            this._removeDevice(devicePath);
        }

        // Disconnect UPower signals
        for (let signalId of this._signalIds) {
            try {
                Gio.DBus.system.signal_unsubscribe(signalId);
            } catch (e) {}
        }

        super.destroy();
    }
});

let indicator;

function init(metadata) {
    // Nothing needed
}

function enable() {
    indicator = new HeadphoneBatteryIndicator('headphone-battery-percentage@aaron.biju');
    // Add to right side of the status area, index 0. This places it to the immediate left of aggregateMenu
    Main.panel.addToStatusArea('headphone-battery-percentage@aaron.biju', indicator, 0, 'right');
}

function disable() {
    if (indicator) {
        indicator.destroy();
        indicator = null;
    }
}
