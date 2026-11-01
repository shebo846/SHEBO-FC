const $ = id => document.getElementById(id);
let latest = null;
let busy = false;

const status = message => $("status").textContent = message;
const setProgress = value => $("progress").style.width = value + "%";
const setBusy = value => {
  busy = value;
  $("check").disabled = value;
  $("play").disabled = value || !latest?.gameReady;
};

window.sheboLauncher.onProgress(({ value, message }) => {
  setProgress(value);
  status(message);
});

async function checkForUpdates() {
  if (busy) return;
  setBusy(true);
  status("Проверяем наличие обновлений…");
  setProgress(0);
  try {
    latest = await window.sheboLauncher.checkUpdate();
    $("installed").textContent = latest.installedVersion || "Не установлена";
    $("latest").textContent = latest.version;
    $("notes").textContent = latest.notes;
    if (latest.updateAvailable) {
      status(latest.gameReady
        ? "Доступно обновление. Нажми «Установить обновление»."
        : "Нужно установить игру. Нажми «Установить игру».");
      $("check").textContent = latest.gameReady ? "УСТАНОВИТЬ ОБНОВЛЕНИЕ" : "УСТАНОВИТЬ ИГРУ";
      $("check").onclick = installUpdate;
    } else {
      status("Установлена последняя версия. Можно играть!");
      $("check").textContent = "ПРОВЕРИТЬ ЕЩЁ РАЗ";
      $("check").onclick = checkForUpdates;
    }
    $("play").disabled = !latest.gameReady;
  } catch (error) {
    status(error.message || "Не удалось проверить обновления.");
    $("latest").textContent = "Ошибка";
    $("play").disabled = true;
    $("check").textContent = "ПОВТОРИТЬ ПРОВЕРКУ";
    $("check").onclick = checkForUpdates;
  } finally {
    setBusy(false);
  }
}

async function installUpdate() {
  if (!latest || busy) return;
  setBusy(true);
  $("play").disabled = true;
  setProgress(1);
  try {
    await window.sheboLauncher.installUpdate(latest.downloadUrl, latest.version);
    $("installed").textContent = latest.version;
    status("Готово! Игра установлена — можно играть.");
    $("check").textContent = "ПРОВЕРИТЬ ЕЩЁ РАЗ";
    $("check").onclick = checkForUpdates;
    latest.gameReady = true;
    latest.installedVersion = latest.version;
    latest.updateAvailable = false;
    $("play").disabled = false;
  } catch (error) {
    status(error.message || "Ошибка установки обновления.");
    $("check").textContent = "ПОВТОРИТЬ УСТАНОВКУ";
    $("check").onclick = installUpdate;
  } finally {
    setBusy(false);
  }
}

// Use only onclick assignments: a permanent click listener here would also run
// checkForUpdates when the button has been switched to installUpdate.
$("check").onclick = checkForUpdates;
$("play").addEventListener("click", async () => {
  try {
    await window.sheboLauncher.playGame();
    status("Игра запускается…");
  } catch (error) {
    status(error.message || "Не удалось запустить игру.");
  }
});
$("releases").addEventListener("click", () => window.sheboLauncher.openReleases());

(async () => {
  try {
    const state = await window.sheboLauncher.getState();
    $("installed").textContent = state.installedVersion || "Не установлена";
    $("play").disabled = !state.gameReady;
    status(state.gameReady ? "Игра найдена. Проверяем обновления…" : "Добро пожаловать! Подготовим установку игры.");
  } catch {}
  await checkForUpdates();
})();
