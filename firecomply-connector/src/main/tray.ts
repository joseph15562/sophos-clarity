import { Tray, Menu, nativeImage, type BrowserWindow } from "electron";
import path from "node:path";

let tray: Tray | null = null;

export function setupTray(
  mainWindow: BrowserWindow,
  onRunNow: () => void,
  onTogglePause: () => void
): void {
  const iconPath = path.join(__dirname, "../../assets/tray-icon.png");
  let icon: Electron.NativeImage;

  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("FireComply Connector — Running");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { label: "Run Now", click: onRunNow },
    { label: "Pause / Resume", click: onTogglePause },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        mainWindow.destroy();
        process.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function updateTrayTooltip(text: string): void {
  tray?.setToolTip(text);
}
