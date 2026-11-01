const $ = id => document.getElementById(id);
let latest = null;
const status = (message) => $("status").textContent = message;
const setProgress = (value) => $("progress").style.width = value + "%";

window.sheboLauncher.onProgress(({ value, message }) => { setProgress(value); status(message); });

$("check").addEventListener("click", async () => {
  $("check").disabled = true;
  status("Проверяем наличие обновлений…");
  setProgress(0);
  try {
    latest = await window.sheboLauncher.checkUpdate();
    $("installed").textContent = latest.installedVersion || "Не установлена";
    $("latest").textContent = latest.version;
    $("notes").textContent = latest.notes;
    if (latest.updateAvailable) {
      status("Доступно новое обновление. Нажми «Установить обновление».");
      $("check").textContent = "УСТАНОВИТЬ ОБНОВЛЕНИЕ";
      $("check").disabled = false;
      $("check").onclick = install;
      $("play").disabled = !latest.installedVersion;
    } else {
      status("У тебя последняя версия игры. Можно играть!");
      $("check").textContent = "ПРОВЕРИТЬ ЕЩЁ РАЗ";
      $("check").onclick = null;
      $("play").disabled = false;
    }
  } catch (error) {
    status(error.message || "Не удалось проверить обновления.");
    $("latest").textContent = "Ошибка";
    $("check").disabled = false;
  }
});

async function install() {
  if (!latest) return;
  $("check").disabled = true;
  $("play").disabled = true;
  setProgress(1);
  try {
    await window.sheboLauncher.installUpdate(latest.downloadUrl, latest.version);
    $("installed").textContent = latest.version;
    status("Готово! Обновление установлено — можно играть.");
    $("check").textContent = "ПРОВЕРИТЬ ЕЩЁ РАЗ";
    $("check").onclick = null;
    $("check").disabled = false;
    $("play").disabled = false;
  } catch (error) {
    status(error.message || "Ошибка установки обновления.");
    $("check").disabled = false;
  }
}

$("play").addEventListener("click", async () => {
  try { await window.sheboLauncher.playGame(); }
  catch (error) { status(error.message || "Не удалось запустить игру."); }
});
$("releases").addEventListener("click", () => window.sheboLauncher.openReleases());
