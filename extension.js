const { GObject, St, Gio, GLib, Clutter } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

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
        this._bluezDevices = {};
        this._bluezSignalIds = [];
        this._menuItems = {};

        this.box = new St.BoxLayout({ 
            style_class: 'panel-status-menu-box',
            pack_start: true
        });
        
        this.icon = new St.Icon({
            icon_name: 'bluetooth-disabled-symbolic',
            style_class: 'system-status-icon',
            y_align: Clutter.ActorAlign.CENTER
        });

        this.label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-label'
        });
        
        // Bold text with subtle horizontal margins to fit cleanly beside the bluetooth icon
        this.label.set_style('font-weight: bold; margin-left: 6px; margin-right: 6px;');
        
        this.box.add_child(this.icon);
        this.box.add_child(this.label);
        this.add_child(this.box);
        
        this.show();

        this._initUPower();
        this._initBluez();
    }

    _initBluez() {
        let objAddedId = Gio.DBus.system.signal_subscribe(
            'org.bluez',
            'org.freedesktop.DBus.ObjectManager',
            'InterfacesAdded',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, ifaceName, signalName, parameters) => {
                let [objPath, interfaces] = parameters.deepUnpack();
                if (interfaces['org.bluez.Device1']) {
                    this._addBluezDevice(objPath, interfaces['org.bluez.Device1']);
                }
            }
        );
        this._bluezSignalIds.push(objAddedId);
        
        let objRemovedId = Gio.DBus.system.signal_subscribe(
            'org.bluez',
            'org.freedesktop.DBus.ObjectManager',
            'InterfacesRemoved',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, ifaceName, signalName, parameters) => {
                let [objPath, interfaces] = parameters.deepUnpack();
                if (interfaces.includes('org.bluez.Device1')) {
                    this._removeBluezDevice(objPath);
                }
            }
        );
        this._bluezSignalIds.push(objRemovedId);
        
        let propsId = Gio.DBus.system.signal_subscribe(
            'org.bluez',
            'org.freedesktop.DBus.Properties',
            'PropertiesChanged',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, ifaceName, signalName, parameters) => {
                let [iface, changedProps, invalidatedProps] = parameters.deepUnpack();
                if (iface === 'org.bluez.Device1' && this._bluezDevices[path]) {
                    this._updateBluezDeviceProps(path, changedProps);
                }
            }
        );
        this._bluezSignalIds.push(propsId);
        
        Gio.DBus.system.call(
            'org.bluez',
            '/',
            'org.freedesktop.DBus.ObjectManager',
            'GetManagedObjects',
            null,
            null,
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (conn, res) => {
                try {
                    let result = conn.call_finish(res);
                    let [objects] = result.deepUnpack();
                    for (let path in objects) {
                        let interfaces = objects[path];
                        if (interfaces['org.bluez.Device1']) {
                            this._addBluezDevice(path, interfaces['org.bluez.Device1']);
                        }
                    }
                } catch(e) {
                    logError(e, '[HeadphoneBatteryIndicator] Failed to get managed objects');
                }
            }
        );
    }

    _unpackProp(prop) {
        return prop ? (prop.deepUnpack ? prop.deepUnpack() : prop.unpack()) : null;
    }

    _addBluezDevice(path, props) {
        let paired = this._unpackProp(props.Paired);
        let name = this._unpackProp(props.Name) || this._unpackProp(props.Alias) || 'Unknown';
        let connected = this._unpackProp(props.Connected);
        
        this._bluezDevices[path] = {
            paired: paired,
            name: name,
            connected: connected
        };
        this._updateDisplay();
    }
    
    _removeBluezDevice(path) {
        if (this._bluezDevices[path]) {
            delete this._bluezDevices[path];
            this._updateDisplay();
        }
    }
    
    _updateBluezDeviceProps(path, changedProps) {
        let dev = this._bluezDevices[path];
        if (!dev) return;
        
        let changed = false;
        
        if ('Paired' in changedProps) {
            dev.paired = this._unpackProp(changedProps['Paired']);
            changed = true;
        }
        if ('Name' in changedProps) {
            dev.name = this._unpackProp(changedProps['Name']);
            changed = true;
        } else if ('Alias' in changedProps) {
            dev.name = this._unpackProp(changedProps['Alias']);
            changed = true;
        }
        if ('Connected' in changedProps) {
            dev.connected = this._unpackProp(changedProps['Connected']);
            changed = true;
        }
        
        if (changed) {
            this._updateDisplay();
        }
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
        let hasConnectedDevices = false;
        
        for (let path in this._bluezDevices) {
            if (this._bluezDevices[path].connected) {
                hasConnectedDevices = true;
                break;
            }
        }

        for (let devicePath in this._devices) {
            let percentage = this._getProperty(devicePath, 'Percentage');
            let type = this._getProperty(devicePath, 'Type');

            if (percentage !== null && percentage !== undefined && percentage > 0) {
                let icon = DEVICE_ICONS[type] || '🔋';
                displayTexts.push(`${icon} ${Math.round(percentage)}%`);
                hasConnectedDevices = true;
            }
        }

        if (displayTexts.length > 0) {
            this.label.set_text(displayTexts.join(' | '));
            this.label.show();
        } else {
            this.label.set_text('');
            this.label.hide();
        }
        
        if (hasConnectedDevices) {
            if (displayTexts.length > 0) {
                this.icon.hide();
            } else {
                this.icon.icon_name = 'bluetooth-active-symbolic';
                this.icon.show();
            }
        } else {
            this.icon.icon_name = 'bluetooth-disabled-symbolic';
            this.icon.show();
        }

        this.show();
        this._updateMenu();
    }

    _updateMenu() {
        for (let path in this._menuItems) {
            if (!this._bluezDevices[path] || !this._bluezDevices[path].paired) {
                this._menuItems[path].destroy();
                delete this._menuItems[path];
            }
        }
        
        for (let path in this._bluezDevices) {
            let bluezDev = this._bluezDevices[path];
            if (!bluezDev.paired) continue;
            
            let batteryText = "";
            if (bluezDev.connected) {
                let macString = path.includes('dev_') ? path.split('dev_')[1] : null;
                if (macString) {
                    for (let upowerPath in this._devices) {
                        if (upowerPath.includes(macString)) {
                            let percentage = this._getProperty(upowerPath, 'Percentage');
                            if (percentage !== null && percentage !== undefined && percentage > 0) {
                                batteryText = ` (${Math.round(percentage)}%)`;
                            }
                            break;
                        }
                    }
                }
            }
            
            let labelText = bluezDev.name + batteryText;
            
            if (this._menuItems[path]) {
                let menuItem = this._menuItems[path];
                if (menuItem.label.text !== labelText) {
                    menuItem.label.text = labelText;
                }
                if (menuItem.state !== bluezDev.connected) {
                    menuItem._ignoreToggle = true;
                    menuItem.setToggleState(bluezDev.connected);
                    menuItem._ignoreToggle = false;
                }
            } else {
                let menuItem = new PopupMenu.PopupSwitchMenuItem(labelText, bluezDev.connected);
                menuItem._ignoreToggle = false;
                menuItem.connect('toggled', (item, state) => {
                    if (item._ignoreToggle) return;
                    
                    bluezDev.connected = state; 
                    let method = state ? 'Connect' : 'Disconnect';
                    Gio.DBus.system.call(
                        'org.bluez',
                        path,
                        'org.bluez.Device1',
                        method,
                        null,
                        null,
                        Gio.DBusCallFlags.NONE,
                        -1,
                        null,
                        (conn, res) => {
                            try {
                                conn.call_finish(res);
                            } catch(e) {
                                logError(e, `[HeadphoneBatteryIndicator] Failed to ${method} ${path}`);
                                bluezDev.connected = !state;
                                item._ignoreToggle = true;
                                item.setToggleState(!state);
                                item._ignoreToggle = false;
                            }
                        }
                    );
                });
                this.menu.addMenuItem(menuItem);
                this._menuItems[path] = menuItem;
            }
        }
    }

    destroy() {
        for (let path in this._menuItems) {
            if (this._menuItems[path]) {
                this._menuItems[path].destroy();
            }
        }
        this._menuItems = {};

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

        // Disconnect BlueZ signals
        for (let signalId of this._bluezSignalIds) {
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
