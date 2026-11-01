const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const extract = require("extract-zip");

const OWNER = "shebo846";
const REPO = "SHEBO-FC";
const GAME_ASSET = "SHEBO-FC-Windows.zip";
const GAME_DIR = path.join(app.getPath("appData"), "SHEBO FC", "Game");
const VERSION_FILE = path.join(GAME_DIR, ".shebo-version.json");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 980, height: 660, minWidth: 820, minHeight: 580,
    backgroundColor: "#080d18",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile("index.html");
}

function sendProgress(value, message) {
  if (win && !win.isDestroyed()) win.webContents.send("update-progress", { value, message });
}

async function getLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { "Accept": "application/vnd.github+json", "User-Agent": "SHEBO-FC-Launcher" }
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Пока нет опубликованного релиза игры. Сначала нужно загрузить первый релиз в GitHub Releases.");
    throw new Error(`GitHub вернул ошибку ${response.status}`);
  }
  return response.json();
}

function readInstalledVersion() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")).version || null; }
  catch { return null; }
}

ipcMain.handle("check-update", async () => {
  const release = await getLatestRelease();
  const asset = (release.assets || []).find(item => item.name === GAME_ASSET);
  if (!asset) throw new Error(`В релизе нет файла ${GAME_ASSET}. Добавь ZIP игры с таким названием.`);
  const installedVersion = readInstalledVersion();
  return {
    version: release.tag_name,
    installedVersion,
    updateAvailable: installedVersion !== release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || "Описание обновления не добавлено.",
    publishedAt: release.published_at,
    assetName: asset.name,
    downloadUrl: asset.browser_download_url
  };
});

ipcMain.handle("install-update", async (_event, downloadUrl, version) => {
  if (typeof downloadUrl !== "string" || !downloadUrl.startsWith("https://")) throw new Error("Некорректная ссылка обновления.");
  fs.mkdirSync(GAME_DIR, { recursive: true });
  const tempZip = path.join(os.tmpdir(), "shebo-fc-update.zip");
  sendProgress(2, "Подключаемся к GitHub…");
  const response = await fetch(downloadUrl, { headers: { "User-Agent": "SHEBO-FC-Launcher" } });
  if (!response.ok || !response.body) throw new Error("Не удалось скачать обновление.");
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const output = fs.createWriteStream(tempZip);
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!output.write(Buffer.from(value))) await new Promise(resolve => output.once("drain", resolve));
      const pct = total ? Math.min(85, Math.round(received / total * 85)) : 25;
      sendProgress(pct, "Скачиваем файлы игры…");
    }
  } finally {
    output.end();
    await new Promise(resolve => output.once("close", resolve));
  }
  sendProgress(88, "Распаковываем обновление…");
  await extract(tempZip, { dir: GAME_DIR });
  fs.rmSync(tempZip, { force: true });
  fs.writeFileSync(VERSION_FILE, JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2));
  sendProgress(100, "Обновление установлено!");
  return { ok: true, gameDir: GAME_DIR };
});

function findGameExe(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe") && !entry.name.toLowerCase().includes("setup") && !entry.name.toLowerCase().includes("launcher")) return path.join(dir, entry.name);
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findGameExe(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

ipcMain.handle("play-game", async () => {
  const exe = findGameExe(GAME_DIR);
  if (!exe) throw new Error("Игра ещё не установлена. Сначала проверь и установи обновление.");
  const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: "ignore" });
  child.unref();
  return { ok: true };
});

ipcMain.handle("open-releases", () => shell.openExternal(`https://github.com/${OWNER}/${REPO}/releases`));
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
