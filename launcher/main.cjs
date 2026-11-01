const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const extract = require("extract-zip");

const OWNER = "shebo846";
const REPO = "SHEBO-FC";
const GAME_ASSET = "SHEBO-FC-Windows.zip";
const ROOT_DIR = path.join(app.getPath("appData"), "SHEBO FC");
const GAME_DIR = path.join(ROOT_DIR, "Game");
const VERSION_FILE = path.join(GAME_DIR, ".shebo-version.json");
const TEMP_DIR = path.join(ROOT_DIR, "Update-Staging");
let win;
let busy = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1020, height: 700, minWidth: 820, minHeight: 600,
    backgroundColor: "#080d18", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

function sendProgress(value, message) {
  if (win && !win.isDestroyed()) win.webContents.send("update-progress", { value, message });
}

async function getLatestRelease() {
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "SHEBO-FC-Launcher" }
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Первый релиз игры ещё не опубликован. Подготовим Windows-сборку и загрузим её в GitHub Releases.");
    throw new Error(`GitHub вернул ошибку ${response.status}. Проверь подключение к интернету.`);
  }
  return response.json();
}

function readInstalledVersion() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, "utf8")).version || null; }
  catch { return null; }
}

function findGameExe(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe") &&
        !/(setup|uninstall|launcher)/i.test(entry.name)) return path.join(dir, entry.name);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "Update-Staging") {
      const found = findGameExe(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

ipcMain.handle("launcher-state", async () => ({
  installedVersion: readInstalledVersion(),
  gameReady: Boolean(findGameExe(GAME_DIR)),
  gameDir: GAME_DIR
}));

ipcMain.handle("check-update", async () => {
  const release = await getLatestRelease();
  const asset = (release.assets || []).find(item => item.name === GAME_ASSET);
  if (!asset) throw new Error(`В последнем релизе нет ${GAME_ASSET}. Сначала загрузим готовую Windows-сборку игры.`);
  const installedVersion = readInstalledVersion();
  const gameReady = Boolean(findGameExe(GAME_DIR));
  return {
    version: release.tag_name, installedVersion, gameReady,
    updateAvailable: !gameReady || installedVersion !== release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || "Описание обновления не добавлено.",
    publishedAt: release.published_at,
    assetName: asset.name, downloadUrl: asset.browser_download_url
  };
});

ipcMain.handle("install-update", async (_event, downloadUrl, version) => {
  if (busy) throw new Error("Установка уже выполняется.");
  if (typeof downloadUrl !== "string" || !downloadUrl.startsWith(`https://github.com/${OWNER}/`)) {
    throw new Error("Ссылка загрузки не прошла проверку безопасности.");
  }
  busy = true;
  const tempZip = path.join(os.tmpdir(), "shebo-fc-update.zip");
  try {
    fs.mkdirSync(ROOT_DIR, { recursive: true });
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    sendProgress(2, "Подключаемся к GitHub…");
    const response = await fetch(downloadUrl, { headers: { "User-Agent": "SHEBO-FC-Launcher" } });
    if (!response.ok || !response.body) throw new Error("Не удалось скачать ZIP игры.");
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
        sendProgress(total ? Math.min(80, Math.round(received / total * 80)) : 20, "Скачиваем файлы игры…");
      }
    } finally {
      output.end();
      await new Promise((resolve, reject) => {
        output.once("close", resolve);
        output.once("error", reject);
      });
    }
    sendProgress(84, "Распаковываем игру…");
    await extract(tempZip, { dir: TEMP_DIR });
    if (!findGameExe(TEMP_DIR)) {
      throw new Error("В архиве нет готового EXE игры. Нужен ZIP с Windows-сборкой SHEBO FC, а не исходный код сайта.");
    }
    sendProgress(92, "Заменяем файлы игры…");
    const backupDir = path.join(ROOT_DIR, "Game-Backup");
    fs.rmSync(backupDir, { recursive: true, force: true });
    if (fs.existsSync(GAME_DIR)) fs.renameSync(GAME_DIR, backupDir);
    try {
      fs.renameSync(TEMP_DIR, GAME_DIR);
    } catch (error) {
      if (fs.existsSync(backupDir)) fs.renameSync(backupDir, GAME_DIR);
      throw error;
    }
    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.writeFileSync(VERSION_FILE, JSON.stringify({ version, installedAt: new Date().toISOString() }, null, 2));
    sendProgress(100, "Игра установлена! Можно запускать.");
    return { ok: true };
  } catch (error) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(tempZip, { force: true });
    busy = false;
  }
});

ipcMain.handle("play-game", async () => {
  const exe = findGameExe(GAME_DIR);
  if (!exe) throw new Error("Windows-версия игры ещё не установлена. Сначала установи обновление.");
  const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: "ignore" });
  child.unref();
  return { ok: true };
});

ipcMain.handle("open-releases", () => shell.openExternal(`https://github.com/${OWNER}/${REPO}/releases`));
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
