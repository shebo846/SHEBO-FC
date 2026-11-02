#define MyAppName "SHEBO FC"
#define MyAppVersion "4.1.7"
#define MyAppExeName "SHEBO FC.exe"

[Setup]
AppId={{D7E51A9D-8B3D-4D92-9C8A-51E4F3B27A41}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\SHEBO FC
DefaultGroupName=SHEBO FC
OutputDir=output
OutputBaseFilename=SHEBO-FC-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "..\game\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\SHEBO FC"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\SHEBO FC"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; GroupDescription: "Дополнительные задачи:"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Запустить SHEBO FC"; Flags: postinstall nowait skipifsilent
